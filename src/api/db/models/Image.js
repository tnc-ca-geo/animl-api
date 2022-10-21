const { text } = require('node:stream/consumers');
const _ = require('lodash');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { DuplicateError, DBValidationError } = require('../../errors');
const crypto = require('crypto');
const Image = require('../schemas/Image');
const Camera = require('../schemas/Camera');
const automation = require('../../../automation');
const { WRITE_OBJECTS_ROLES, WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } = require('../../auth/roles');
const utils = require('./utils');
const { idMatch } = require('./utils');
const retry = require('async-retry');

const generateImageModel = ({ user } = {}) => ({

  countImages: async (input) => {
    const query = utils.buildFilter(input.filters, user['curr_project']);
    const count = await Image.where(query).countDocuments();
    return count;
  },

  queryById: async (_id) => {
    const query = !user['is_superuser']
      ? { _id, projectId: user['curr_project'] }
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
        query: utils.buildFilter(input.filters, user['curr_project']),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous
      };
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
    console.log('Image.getLabels() - projId: ', projId);
    try {

      const [categoriesAggregate] = await Image.aggregate([
        { $match: { 'projectId': projId } },
        { $unwind: '$objects' },
        { $unwind: '$objects.labels' },
        { $match: { 'objects.labels.validation.validated': { $not: { $eq: false } } } },
        { $group: { _id: null, uniqueCategories: {
          $addToSet: '$objects.labels.category'
        } } }
      ]);

      const categories = categoriesAggregate
        ? categoriesAggregate.uniqueCategories
        : [];

      const objectLessImage = await Image.findOne({
        projectId: projId,
        objects: { $size: 0 }
      });
      if (objectLessImage) categories.push('none');

      return { categories };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  // BUG: I think when you upload multiple images at once from the same camera,
  // and there's not yet a camera record associated with it,
  // some issues occur due to the camera record not being created fast enough
  // for some of the new images? Investigate
  get createImage() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return async (input, context) => {
      const successfulOps = [];
      const md = utils.sanitizeMetadata(input.md);
      let projectId = 'default_project';

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
          console.log('Image.createImage() - no existing cam found, socreating one');
          await context.models.Camera.createCamera({
            projectId,
            cameraId,
            make: md.make,
            ...(md.model && { model: md.model })
          }, context);

          successfulOps.push({ op: 'cam-created', info: { cameraId } });
        }
        else {
          projectId = utils.findActiveProjReg(existingCam);
          console.log('Image.createImage() - existing cam found, updating projectId to: ', projectId);
        }

        // map image to deployment
        const [project] = await context.models.Project.getProjects([projectId]);
        console.log('Image.createImage() - project: ', project);
        const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));
        console.log('Image.createImage() - camConfig: ', camConfig);
        const deployment = utils.mapImgToDep(md, camConfig, project.timezone);
        console.log('Image.createImage() - deployment: ', deployment);
        console.log('Image.createImage() - timezone: ', deployment.timezone);

        // create image record
        md.projectId = projectId;
        md.deploymentId = deployment._id;
        md.timezone = deployment.timezone;
        console.log('md.dateTimeOriginal BEFORE TZ adjustment: ', md.dateTimeOriginal.toString());
        md.dateTimeOriginal = md.dateTimeOriginal.setZone(deployment.timezone, { keepLocalTime: true });
        console.log('md.dateTimeOriginal AFTEr TZ adjustment: ', md.dateTimeOriginal.toString());
        console.log('md.dateTimeOriginal AFTEr TZ adjustment, valueOf(): ', md.dateTimeOriginal.valueOf());

        const image = await saveImage(md);
        await automation.handleEvent({ event: 'image-added', image }, context);
        return image;

      } catch (err) {

        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-created') {
            console.log('Image.createImage() - an error occured, so reversing successful cam-created operation');
            // delete newly created camera record
            await Camera.findOneAndDelete({ _id: op.info.cameraId });
            // find project, remove newly created cameraConfig record
            const [proj] = await context.models.Project.getProjects([projectId]);
            proj.cameraConfigs = proj.cameraConfigs.filter((camConfig) => (
              !idMatch(camConfig._id, op.info.cameraId)
            ));
            proj.save();
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
    };
  },

  get createObject() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async ({ imageId, object }) => {
        return await retry(async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying createObject operation! Try #: ${attempt}`);
          }

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
    };
  },

  get updateObject() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log('ImageModel.updateObject() - input: ', input);

      const operation = async ({ imageId, objectId, diffs }) => {
        return await retry(async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying updateObject operation! Try #: ${attempt}`);
          }
          // find image, apply object updates, and save
          const image = await this.queryById(imageId);
          const object = image.objects.find((obj) => idMatch(obj._id, objectId));
          if (!object) {
            const msg = `Couldn't find object "${objectId}" on img "${imageId}"`;
            bail(new ApolloError(msg));
          }
          for (const [key, newVal] of Object.entries(diffs)) {
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
    };
  },

  get deleteObject() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async ({ imageId, objectId }) => {
        return await retry(async () => {

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
    };
  },

  get createLabels() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input, context) => {

      const operation = async ({ imageId, objectId, label }) => {
        return await retry(async () => {

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
                labels: [labelRecord]
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
              image
            }, context);
          }
        }
        return image;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get updateLabel() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async (input) => {
        const { imageId, objectId, labelId, diffs } = input;
        return await retry(async () => {

          // find label, apply updates, and save image
          const image = await this.queryById(imageId);
          const object = image.objects.find((obj) => idMatch(obj._id, objectId));
          const label = object.labels.find((lbl) => idMatch(lbl._id, labelId));
          for (const [key, newVal] of Object.entries(diffs)) {
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
    };
  },

  get deleteLabel() {
    if (!utils.hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async ({ imageId, objectId, labelId }) => {
        return await retry(async () => {

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
    };
  },

  getStats: async (input) => {
    let imageCount = 0;
    let reviewed = 0;
    let notReviewed = 0;
    const reviewerList = [];
    const labelList = {};
    // NOTE: just curious how many images get touched
    // by more than one reviewer. can remove later
    let multiReviewerCount = 0;

    try {
      const query = utils.buildFilter(input.filters, user['curr_project']);
      const images = await Image.find(query, ['objects']);
      imageCount = images.length;
      for (const img of images) {

        // increment reviewedCount
        utils.isImageReviewed(img) ? reviewed++ : notReviewed++;

        // build reviwer list
        let reviewers = [];
        for (const obj of img.objects) {
          for (const lbl of obj.labels) {
            if (lbl.validation) reviewers.push(lbl.validation.userId);
          }
        }
        reviewers = _.uniq(reviewers);
        if (reviewers.length > 1) multiReviewerCount++;

        for (const userId of reviewers) {
          const usr = reviewerList.find((reviewer) => reviewer.userId === userId);
          !usr
            ? reviewerList.push({ userId: userId, reviewedCount: 1 })
            : usr.reviewedCount++;
        }

        // order reviewer list by reviewed count
        reviewerList.sort((a, b) => b.reviewedCount - a.reviewedCount);

        // build label list
        for (const obj of img.objects) {
          if (obj.locked) {
            const firstValidLabel = obj.labels.find((label) => (
              label.validation && label.validation.validated
            ));
            if (firstValidLabel) {
              const cat = firstValidLabel.category;
              labelList[cat] = Object.prototype.hasOwnProperty.call(labelList, cat)
                ? labelList[cat] + 1
                : 1;
            }
          }
        }

      }

      return {
        imageCount,
        reviewedCount: { reviewed, notReviewed },
        reviewerList,
        labelList,
        multiReviewerCount
      };

    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  get exportCSV() {
    if (!utils.hasRole(user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return async (input, context) => {

      console.log('exporting to csv...');

      const s3 = new S3Client({ region: process.env.AWS_DEFAULT_REGION });
      const sqs = new SQSClient({ region: process.env.AWS_DEFAULT_REGION });
      const id = crypto.randomBytes(16).toString('hex');
      const bucket = context.config['/EXPORTS/EXPORTED_DATA_BUCKET'];
      // const filename = id + '.csv';

      try {

        console.log('creating status document in s3...');
        // create status document in S3
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: `${id}.json`,
          Body: JSON.stringify({ status: 'Pending' }),
          ContentType: 'application/json; charset=utf-8'
        }));

        console.log('sending message to sqs queue: ', context.config['/EXPORTS/EXPORT_QUEUE_URL']);
        // push message to SQS with { projectId, documentId, filters }
        await sqs.send(new SendMessageCommand({
          QueueUrl: context.config['/EXPORTS/EXPORT_QUEUE_URL'],
          MessageBody: JSON.stringify({
            projectId: user['curr_project'],
            documentId: id,
            filters: input.filters
          })
        }));

        return {
          documentId: id
        };

      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get getExportStatus() {
    if (!utils.hasRole(user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return async ({ documentId }, context) => {

      console.log('gettingExportStatus...');

      const s3 = new S3Client({ region: process.env.AWS_DEFAULT_REGION });
      const bucket = context.config['/EXPORTS/EXPORTED_DATA_BUCKET'];

      try {

        console.log('getting status object from s3');
        const { Body } = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: `${documentId}.json`
        }));

        const objectText = await text(Body);
        console.log('res: ', JSON.parse(objectText));
        return JSON.parse(objectText);

      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  }

});

module.exports = generateImageModel;
