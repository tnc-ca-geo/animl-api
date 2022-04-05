const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { DuplicateError, DBValidationError } = require('../../errors');
const Image = require('../schemas/Image');
const automation = require('../../../automation');
const { WRITE_OBJECTS_ROLES, WRITE_IMAGES_ROLES } = require('../../auth/roles');
const utils = require('./utils');
const retry = require('async-retry');

const generateImageModel = ({ user } = {}) => ({

  countImages: async (input) => {
    console.log(`ImageModel.countImages() - `);
    const query = utils.buildFilter(input, user);
    const count = await Image.where(query).countDocuments();
    return count;
  },

  queryById: async (_id) => {
    console.log(`ImageModel.queryById() - _id: ${_id}`);
    try {
      const image = await Image.findOne({_id});
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
        { $match: {'project': projId} }, // NEW - limit aggregation to specific project
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
        { project: projId, objects: { $size: 0 } }
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
        // find camera record or create new one
        const cameraSn = md.serialNumber;
        const [existingCam] = await context.models.Camera.getCameras([cameraSn]);
        if (!existingCam) {
          console.log(`createImage() - Couldn't find a camera for image, so creating new one...`);
          await context.models.Camera.createCamera({
            projectId,
            cameraId: cameraSn,
            make: md.make,
            ...(md.model && { model: md.model }),
          }, context);
        }
        else {
          console.log(`createImage() - Found camera - ${existingCam}`);
          projectId = utils.findActiveProjReg(existingCam);
        }

        // map image to deployment
        const [project] = await context.models.Project.getProjects([projectId]);
        console.log(`createImage() - found project: ${project}`);
        const camConfig = project.cameras.find((cam) => 
          cam._id.toString() === cameraSn.toString()
        );
        const deploymentId = utils.mapImageToDeployment(md, camConfig);
        console.log(`createImage() - mapped to deployment: ${deploymentId}`);

        // create image record
        md.project = projectId;
        md.deployment = deploymentId;
        const image = await saveImage(md);
        await automation.handleEvent({ event: 'image-added', image }, context);
        return image;

      } catch (err) {
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
          const object = image.objects.find((obj) => (
            obj._id.toString() === objectId.toString()
          ));
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
            obj._id.toString() !== objectId.toString()
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

  // TODO AUTH - createLabel can be executed by superuser (if ML predicted label) 
  // do we need to know what project the label belongs to? if so how do we determine that?
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
            const object = image.objects.find((obj) => (
              obj._id.toString() === objectId.toString()
            ));
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
          const object = image.objects.find((obj) => (
            obj._id.toString() === objectId.toString()
          ));
          const label = object.labels.find((lbl) => (
            lbl._id.toString() === labelId.toString()
          ));
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
          const object = image.objects.find((obj) => (
            obj._id.toString() === objectId.toString()
          ));
          const newLabels = object.labels.filter((lbl) => (
            lbl._id.toString() !== labelId.toString()
          ));
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
