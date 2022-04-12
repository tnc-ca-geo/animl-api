const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { DuplicateError, DBValidationError } = require('../../errors');
const Image = require('../schemas/Image');
const Camera = require('../schemas/Camera');
const automation = require('../../../automation');
const { WRITE_OBJECTS_ROLES, WRITE_IMAGES_ROLES } = require('../../auth/roles');
const utils = require('./utils');
const { idMatch } = require('./utils');
const retry = require('async-retry');

const generateImageModel = ({ user } = {}) => ({

  countImages: async (input) => {
    console.log(`ImageModel.countImages() - `);
    const query = utils.buildFilter(input, user);
    const count = await Image.where(query).countDocuments();
    return count;
  },

  queryById: async (_id) => {
    const query = !user['is_superuser'] 
      ? { _id, project: user['curr_project']}
      : { _id };
    try {
      const image = await Image.findOne(query);
      return image;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  queryByFilter: async (input) => {
    try {
      const options = {
        query: utils.buildFilter(input, user),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      };
      console.log(`ImageModel.queryByFilter() - options: ${JSON.stringify(options)}`);
      const result = await Image.paginate(options);
      return result;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  // TODO: this should be called getAllCategories or something like that
  getLabels: async (projId) => {
    try {
      console.log(`ImageModel.getLabels() - projId: ${projId}`);

      const [categoriesAggregate] = await Image.aggregate([
        { $match: {'projectId': projId} },
        { $unwind: '$objects' },
        { $unwind: '$objects.labels' },
        { $match: {'objects.labels.validation.validated': {$not: {$eq: false}}}},
        { $group: {_id: null, uniqueCategories: {
            $addToSet: "$objects.labels.category"
        }}}
      ]);

      let categories = categoriesAggregate
        ? categoriesAggregate.uniqueCategories
        : [];

      const labellessImage = await Image.findOne(
        { projectId: projId, objects: { $size: 0 } }
      );
      if (labellessImage) categories.push('none');
      console.log(`ImageModel.getLabels() - categories: ${categories}`);
      return { categories };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  get createImage() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return async (input, context) => {
      const successfulOps = [];
      const md = utils.sanitizeMetadata(input.md, context.config);
      let projectId = 'default_project';
      console.log(`ImageModel.createImage() - md: ${JSON.stringify(md)}`);

      const saveImage = async (md) => {
        return await retry(async (bail, attempt) => {
          if (attempt > 1) console.log(`Retrying saveImage! Try #: ${attempt}`);
          const newImage = utils.createImageRecord(md);
          return await newImage.save();
        }, { retries: 2 });
      };

      try {
        // find camera record & active registration or create new one
        const cameraId = md.serialNumber;
        const [existingCam] = await context.models.Camera.getCameras([cameraId]);
        if (!existingCam) {
          console.log(`createImage() - Couldn't find a camera for image, so creating new one...`);
          await context.models.Camera.createCamera({
            projectId,
            cameraId,
            make: md.make,
            ...(md.model && { model: md.model }),
          }, context);

          successfulOps.push({ op: 'cam-created', info: { cameraId } });
        }
        else {
          console.log(`createImage() - Found camera - ${existingCam}`);
          projectId = utils.findActiveProjReg(existingCam);
        }

        // map image to deployment
        const [project] = await context.models.Project.getProjects([projectId]);
        console.log(`createImage() - found project: ${project}`);
        const camConfig = project.cameraConfigs.find((cc) => (
          idMatch(cc._id, cameraId)
        ));
        const deploymentId = utils.mapImageToDeployment(md, camConfig);
        console.log(`createImage() - mapped to deployment: ${deploymentId}`);

        // create image record
        md.projectId = projectId;
        md.deploymentId = deploymentId;
        const image = await saveImage(md);
        await automation.handleEvent({ event: 'image-added', image }, context);
        return image;

      } catch (err) {

        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-created') {
            console.log(`ImageModel.createImage() - reversing cam-created operation`);
            // delete newly created camera record
            await Camera.findOneAndDelete({ _id: op.info.cameraId });
            // find project, remove newly created cameraConfig record
            const [project] = await context.models.Project.getProjects([projectId]);
            project.cameraConfigs = project.cameraConfigs.filter((camConfig) => (
              !idMatch(camConfig._id, op.info.cameraId)
            ));
            project.save();
          }
        }

        const msg = err.message.toLowerCase();
        if (err instanceof ApolloError) {
          throw err;
        }
        else if (msg.includes('duplicate')) {
          throw new DuplicateError(err);
        }
        else if (msg.includes('validation')) {
          throw new DBValidationError(err);
        }
        throw new ApolloError(err);
      }  
    }
  },

  get createObject() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ImageModel.createObject() - input: ${input}`);

      const operation = async ({ imageId, object }) => {
        return await retry(async (bail, attempt) => {
          if (attempt > 1) console.log(`Retrying createObject operation! Try #: ${attempt}`);

          // find image, add object, and save
          const image = await this.queryById(imageId);
          image.objects.unshift(object);
          await image.save();
          return image;

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get updateObject() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ImageModel.updateObject() - input: ${input}`);

      const operation = async ({ imageId, objectId, diffs }) => {
        return await retry(async (bail) => {

          // find image, apply object updates, and save
          const image = await this.queryById(imageId);
          console.log(`Found image, version number: ${image.__v}`);
          const object = image.objects.find((obj) => idMatch(obj._id, objectId));
          if (!object) {
            const msg = `Couldn't find object "${objectId}" on img "${imageId}"`;
            bail(new ApolloError(msg));
          }
          for (let [key, newVal] of Object.entries(diffs)) {
            object[key] = newVal;
          }
          await image.save();
          return image;
          
        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get deleteObject() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ImageModel.deleteObject() - input: ${JSON.stringify(input)}`);

      const operation = async ({ imageId, objectId }) => {
        return await retry(async (bail) => {

          // find image, filter out object, and save
          const image = await this.queryById(imageId);
          const newObjects = image.objects.filter((obj) => (
            !idMatch(obj._id, objectId)
          ));
          image.objects = newObjects;
          await image.save();
          return image;

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get createLabels() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input, context) => {
      console.log(`ImageModel.createLabels() - input: ${JSON.stringify(input)}`);

      const operation = async ({ imageId, objectId, label }) => {
        return await retry(async (bail) => {

          // find image, create label record
          const image = await this.queryById(imageId);
          if (utils.isLabelDupe(image, label)) return;
          const authorId = label.mlModel || label.userId;
          const labelRecord = utils.createLabelRecord(label, authorId);
  
          // if objectId was specified, find object and save label to it
          // else try to match to existing object bbox and merge label into that
          // else add new object 
          if (objectId) {
            const object = image.objects.find((obj) => idMatch(obj._id, objectId));
            object.labels.unshift(labelRecord);
          }
          else {
            let objExists = false;
            for (const object of image.objects) {
              if (_.isEqual(object.bbox, label.bbox)) {
                object.labels.unshift(labelRecord);
                objExists = true;
                break;
              }
            }
            if (!objExists) {
              image.objects.unshift({
                bbox: labelRecord.bbox,
                locked: false,
                labels: [labelRecord],
              });
            }
          }
  
          await image.save();
          return { image, newLabel: labelRecord };

        }, { retries: 2 });
      };

      try {
        let image;
        for (const label of input.labels) {
          const res = await operation({ ...input, label });
          image = res.image;
          if (label.mlModel) {
            await automation.handleEvent({
              event: 'label-added',
              label: res.newLabel,
              image,
            }, context);
          }
        }
        return image;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get updateLabel() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ImageModel.updateLabel() - input: ${input}`);

      const operation = async (input) => {
        const { imageId, objectId, labelId, diffs } = input;
        return await retry(async (bail) => {

          // find label, apply updates, and save image
          const image = await this.queryById(imageId);
          const object = image.objects.find((obj) => idMatch(obj._id, objectId));
          const label = object.labels.find((lbl) => idMatch(lbl._id, labelId));
          for (let [key, newVal] of Object.entries(diffs)) {
            label[key] = newVal;
          }
          await image.save();
          return image;

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get deleteLabel() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ImageModel.deleteLabel() - input: ${input}`);

      const operation = async ({ imageId, objectId, labelId }) => {
        return await retry(async (bail) => {

          // find object, filter out label, and save image
          const image = await this.queryById(imageId);
          const object = image.objects.find((obj) => idMatch(obj._id, objectId));
          const newLabels = object.labels.filter((lbl) => !idMatch(lbl._id, labelId));
          object.labels = newLabels;
          await image.save();
          return image;

        }, { retries: 2 });
      };
      
      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

 });

module.exports = generateImageModel;
