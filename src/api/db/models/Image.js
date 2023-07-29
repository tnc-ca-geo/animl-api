import { text } from 'node:stream/consumers';
import { DateTime } from 'luxon';
import _ from 'lodash';
import S3 from '@aws-sdk/client-s3';
import SQS from '@aws-sdk/client-sqs';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { DuplicateError, DuplicateLabelError, DBValidationError } from '../../errors.js';
import crypto from 'node:crypto';
import MongoPaging from 'mongo-cursor-pagination';
import Image from '../schemas/Image.js';
import { ImageError } from '../schemas/ImageError.js';
import ImageAttempt from '../schemas/ImageAttempt.js';
import WirelessCamera from '../schemas/WirelessCamera.js';
import Batch from '../schemas/Batch.js';
import { handleEvent } from '../../../automation/index.js';
import { WRITE_OBJECTS_ROLES, WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } from '../../auth/roles.js';
import { hasRole, buildPipeline, mapImgToDep, sanitizeMetadata, isLabelDupe, createImageRecord, createLabelRecord, isImageReviewed, findActiveProjReg } from './utils.js';
import { idMatch } from './utils.js';
import retry from 'async-retry';

const generateImageModel = ({ user } = {}) => ({
  countImages: async (input) => {
    const pipeline = buildPipeline(input.filters, user['curr_project']);
    pipeline.push({ $count: 'count' });
    const res = await Image.aggregate(pipeline);
    return res[0] ? res[0].count : 0;
  },

  queryById: async (_id) => {
    const query = !user['is_superuser']
      ? { _id, projectId: user['curr_project'] }
      : { _id };
    try {
      const image = await Image.findOne(query);

      const epipeline = [];
      epipeline.push({ '$match': { 'image': image._id } });
      image.errors = await ImageError.aggregate(epipeline);

      return image;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  queryByFilter: async (input) => {
    try {
      const result = await MongoPaging.aggregate(Image.collection, {
        aggregation: buildPipeline(input.filters, user['curr_project']),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous
      });
      // console.log('res: ', JSON.stringify(result));
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

      const [categoriesAggregate] = await Image.aggregate([
        { $match: { 'projectId': projId } },
        { $unwind: '$objects' },
        { $unwind: '$objects.labels' },
        { $match: { 'objects.labels.validation.validated': { $not: { $eq: false } } } },
        { $group: { _id: null, uniqueCategories: { $addToSet: '$objects.labels.category' } } }
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

  get createImage() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input, context) => {
      const successfulOps = [];
      const errors = [];
      const md = sanitizeMetadata(input.md);
      let projectId = 'default_project';
      let cameraId = md.serialNumber; // this will be 'unknown' if there's no SN
      let existingCam;
      let imageAttempt;

      // TODO: double check recording and reversal of successful ops - make sure it's doing what we want
      // TODO: add back in required! fields from Image and any code that was added to make images with incomplete metadata not fail
      // TODO: make sure we're not double-adding ImageErrors anywhere

      try {

        // create ImageAttempt record
        try {
          // NOTE: to create the record, we need go generate the image's _id,
          // which means we need to know what project it belongs to
          console.log('Step 1 - create ImageAttempt record');

          if (md.batchId) {
            // if it's from a batch, find the batch record, and use its projectId
            const batch = await Batch.findOne({ _id: md.batchId });
            projectId = batch.projectId;

            // also override the serial number if that flag was set
            if (batch.overrideSerial) {
              md.serialNumber = batch.overrideSerial;
              cameraId = batch.overrideSerial;
            }
          } else {
            // else find wireless camera record and associated project Id
            [existingCam] = await context.models.Camera.getWirelessCameras([cameraId]);
            if (existingCam) {
              projectId = findActiveProjReg(existingCam);
            }
          }

          // create an imageID
          md.imageId = projectId + ':' + md.hash;
          console.log(`imageId: ${md.imageId}`);

          // create an ImageAttempt record (if one doesn't already exist)
          imageAttempt = await ImageAttempt.findOne({ _id: imageId });
          console.log(`existing imageAttempt?: ${JSON.stringify(imageAttempt)}`);
          if (!imageAttempt) {
            imageAttempt = new ImageAttempt({
              _id: md.imageId,
              projectId,
              batchId: md.batchId,
              metadata: {
                _id: md.imageId,
                bucket: md.prodBucket,
                batchId: md.batchId,
                dateAdded: DateTime.now(),
                cameraId: cameraId,
                ...(md.fileTypeExtension && { fileTypeExtension: md.fileTypeExtension }),
                ...(md.dateTimeOriginal && { dateTimeOriginal: md.dateTimeOriginal }),
                ...(md.timezone && { timezone: md.timezone }),
                ...(md.make && { make: md.make }),
                ...(md.model && { model: md.model }),
                ...(md.fileName && { originalFileName: md.fileName }),
                ...(md.imageWidth && { imageWidth: md.imageWidth }),
                ...(md.imageHeight && { imageHeight: md.imageHeight }),
                ...(md.imageBytes && { imageBytes: md.imageBytes }),
                ...(md.MIMEType && { mimeType: md.MIMEType })
              }
            });
            await imageAttempt.save();
            console.log(`new imageAttempt: ${JSON.stringify(imageAttempt)}`);
            successfulOps.push({ op: 'attempt-created', info: { cameraId } });  // might not need this
          }

        } catch (err) {
          // an error here would be a complete failure and we'd want to return early
          throw new ApolloError(err);
        }

        // Step 2 - validate metadata and create Image record
        try {
          // test serial number
          if (!cameraId || cameraId === 'unknown') {
            errors.push(new Error('Unknown Serial Number'));
          }

          // test dateTimeOriginal
          if (!md.dateTimeOriginal) {
            errors.push(new Error('Unknown DateTimeOriginal'));
          }

          // test image size
          if (md.imageBytes >= 4 * 1000000) {
            errors.push(new Error('Image Size Exceed 4mb'));
          }

          if (!errors.length) {
            console.log('no errors so far! creating image record...');
            if (md.batchId) {
              // create camera config if there isn't one yet
              await context.models.Project.createCameraConfig(projectId, cameraId);
            } else if (!existingCam) {
              await context.models.Camera.createWirelessCamera({
                projectId,
                cameraId,
                make: md.make,
                ...(md.model && { model: md.model })
              }, context);
              successfulOps.push({ op: 'cam-created', info: { cameraId } });
            }

            // map image to deployment
            const [project] = await context.models.Project.getProjects([projectId]);
            const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));
            const deployment = mapImgToDep(md, camConfig, project.timezone);

            md.projectId = projectId;
            md.deploymentId = deployment._id;
            md.timezone = deployment.timezone;
            md.dateTimeOriginal = md.dateTimeOriginal.setZone(deployment.timezone, { keepLocalTime: true });

            const image = await retry(async (bail, attempt) => {
              if (attempt > 1) console.log(`Retrying saveImage! Try #: ${attempt}`);
              const newImage = createImageRecord(md);
              return await newImage.save();
            }, { retries: 2 });
            console.log(`image successfully created: ${JSON.stringify(image)}`);
            await handleEvent({ event: 'image-added', image }, context);
          }
        } catch (err) {
          // here I don't think we want to re-throw the error, and instead add them
          // to the error array so that we can create ImageErrors for them
          errors.push(err);
        }

        // Step 4 - if there were errors in the array, create ImageErrors for them
        if (errors.length) {
          for (let i = 0; i < errors.length; i++) {
            console.log(`creating ImageErrors for: ${JSON.stringify(errors[i])}`);
            errors[i] = new ImageError({
              image: md.imageId,
              batch: md.batchId,
              error: errors[i].message
            });
            await errors[i].save();
          }
        }

        // return imageAttempt
        imageAttempt.errors = errors;
        console.log(`returning imageAttempt: ${imageAttempt}`);
        return imageAttempt;

      } catch (err) {
        // reverse successful operations
        for (const op of successfulOps) {
          // TODO: reverse attempt-created? Probably not...
          // TODO: reverse ImageErrors? Probably don't want to do that either
          if (op.op === 'cam-created') {
            console.log('Image.createImage() - an error occurred, so reversing successful cam-created operation');
            // delete newly created camera record
            await WirelessCamera.findOneAndDelete({ _id: op.info.cameraId });
            // find project, remove newly created cameraConfig record
            const [proj] = await context.models.Project.getProjects([projectId]);
            proj.cameraConfigs = proj.cameraConfigs.filter((camConfig) => (
              !idMatch(camConfig._id, op.info.cameraId)
            ));
            proj.save();
          }
        }

        const msg = err.message.toLowerCase();
        console.log(`Image.createImage() ERROR on image ${md.imageId}: ${err}`);

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

  // get createImage() {
  //   if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

  //   return async (input, context) => {
  //     const successfulOps = [];
  //     const md = sanitizeMetadata(input.md);
  //     let projectId = 'default_project';

  //     // Images will be attempted to be stored in the database to preserve the state of the image
  //     // regardless of whether the system was able to process them. If known errors are thrown, they will
  //     // be added to this array to be submitted as ImageError objects that reference the created Image
  //     const errors = [];

  //     try {
  //       let cameraId = md.serialNumber;

  //       if (md.batchId) { // handle image from bulk upload
  //         const batch = await Batch.findOne({ _id: md.batchId });
  //         projectId = batch.projectId;

  //         if (batch.overrideSerial) {
  //           md.serialNumber = batch.overrideSerial;
  //           cameraId = batch.overrideSerial;
  //         }
  //       }

  //       if (!cameraId || cameraId === 'unknown') {
  //         errors.push(new Error('Unknown Serial Number'));
  //       }

  //       if (!md.dateTimeOriginal === 'unknown') {
  //         errors.push(new Error('Unknown DateTimeOriginal'));
  //         // Required to get an Image entry into the DB so we can attach an error
  //         md.dateTimeOriginal = DateTime.fromJSDate(new Date());
  //       }

  //       let project;
  //       let deployment = { _id: null, timezone: null };

  //       if (!errors.length) {
  //         if (md.batchId) {
  //           // create camera config if there isn't one yet
  //           await context.models.Project.createCameraConfig(projectId, cameraId);
  //         } else if (!errors.length) {
  //           // handle image from wireless camera
  //           // find wireless camera record & active registration or create new one
  //           const [existingCam] = await context.models.Camera.getWirelessCameras([cameraId]);
  //           if (!existingCam) {
  //             await context.models.Camera.createWirelessCamera({
  //               projectId,
  //               cameraId,
  //               make: md.make,
  //               ...(md.model && { model: md.model })
  //             }, context);

  //             successfulOps.push({ op: 'cam-created', info: { cameraId } });
  //           } else {
  //             projectId = findActiveProjReg(existingCam);
  //           }
  //         }

  //         // map image to deployment
  //         [project] = await context.models.Project.getProjects([projectId]);
  //         const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));

  //         try {
  //           deployment = mapImgToDep(md, camConfig, project.timezone);
  //         } catch (err) {
  //           if (err.code === 'NoDeployments') errors.push(err);
  //           else throw err;
  //         }
  //       } else {
  //         // Get Default Project as there are errors - There will be no deployments added
  //         [project] = await context.models.Project.getProjects([projectId]);
  //         deployment.timezone = project.timezone;
  //       }

  //       // create image record
  //       md.projectId = projectId;
  //       md.deploymentId = deployment._id;
  //       md.timezone = deployment.timezone;

  //       // Image Size Limit
  //       if (md.imageBytes >= 4 * 1000000) {
  //         errors.push(new Error('Image Size Exceed 4mb'));
  //       }

  //       md.dateTimeOriginal = md.dateTimeOriginal.setZone(deployment.timezone, { keepLocalTime: true });

  //       const image = await retry(async (bail, attempt) => {
  //         if (attempt > 1) console.log(`Retrying saveImage! Try #: ${attempt}`);
  //         const newImage = createImageRecord(md);
  //         return await newImage.save();
  //       }, { retries: 2 });

  //       if (!errors.length) {
  //         await handleEvent({ event: 'image-added', image }, context);
  //       } else {
  //         for (let i = 0; i < errors.length; i++) {
  //           errors[i] = new ImageError({ image: image._id, batch: md.batchId, error: errors[i].message });
  //           await errors[i].save();
  //         }
  //       }

  //       image.errors = errors;
  //       return image;
  //     } catch (err) {
  //       // reverse successful operations
  //       for (const op of successfulOps) {
  //         if (op.op === 'cam-created') {
  //           console.log('Image.createImage() - an error occurred, so reversing successful cam-created operation');
  //           // delete newly created camera record
  //           await WirelessCamera.findOneAndDelete({ _id: op.info.cameraId });
  //           // find project, remove newly created cameraConfig record
  //           const [proj] = await context.models.Project.getProjects([projectId]);
  //           proj.cameraConfigs = proj.cameraConfigs.filter((camConfig) => (
  //             !idMatch(camConfig._id, op.info.cameraId)
  //           ));
  //           proj.save();
  //         }
  //       }

  //       const msg = err.message.toLowerCase();
  //       console.log(`Image.createImage() ERROR on image ${md.hash}: ${err}`);

  //       if (err instanceof ApolloError) {
  //         throw err;
  //       }
  //       else if (msg.includes('duplicate')) {
  //         throw new DuplicateError(err);
  //       }
  //       else if (msg.includes('validation')) {
  //         throw new DBValidationError(err);
  //       }
  //       throw new ApolloError(err);
  //     }
  //   };
  // },

  get createObject() {
    if (!hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
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
    if (!hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input) => {

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
    if (!hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
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

  // TODO: make this only accept a single label at a time
  // to make dealing with errors simpler
  get createLabels() {
    if (!hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return async (input, context) => {

      const operation = async ({ imageId, objectId, label }) => {
        return await retry(async () => {

          // find image, create label record
          const image = await this.queryById(imageId);
          if (isLabelDupe(image, label)) throw new DuplicateLabelError();
          const authorId = label.mlModel || label.userId;
          const labelRecord = createLabelRecord(label, authorId);

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
            await handleEvent({
              event: 'label-added',
              label: res.newLabel,
              image
            }, context);
          }
        }
        return image;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        console.log(`Image.createLabel() ERROR on image ${input.imageId}: ${err}`);
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get updateLabel() {
    if (!hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
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
    if (!hasRole(user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
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
      const pipeline = buildPipeline(input.filters, user['curr_project']);
      const images = await Image.aggregate(pipeline);
      imageCount = images.length;
      for (const img of images) {

        // increment reviewedCount
        isImageReviewed(img) ? reviewed++ : notReviewed++;

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

  get export() {
    if (!hasRole(user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return async (input, context) => {

      const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
      const sqs = new SQS.SQSClient({ region: process.env.AWS_DEFAULT_REGION });
      const id = crypto.randomBytes(16).toString('hex');
      const bucket = context.config['/EXPORTS/EXPORTED_DATA_BUCKET'];

      try {
        // create status document in S3
        await s3.send(new S3.PutObjectCommand({
          Bucket: bucket,
          Key: `${id}.json`,
          Body: JSON.stringify({ status: 'Pending' }),
          ContentType: 'application/json; charset=utf-8'
        }));

        // push message to SQS with { projectId, documentId, filters }
        await sqs.send(new SQS.SendMessageCommand({
          QueueUrl: context.config['/EXPORTS/EXPORT_QUEUE_URL'],
          MessageBody: JSON.stringify({
            projectId: user['curr_project'],
            documentId: id,
            filters: input.filters,
            format: input.format
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
    if (!hasRole(user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return async ({ documentId }, context) => {
      const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
      const bucket = context.config['/EXPORTS/EXPORTED_DATA_BUCKET'];

      try {

        const { Body } = await s3.send(new S3.GetObjectCommand({
          Bucket: bucket,
          Key: `${documentId}.json`
        }));

        const objectText = await text(Body);
        return JSON.parse(objectText);

      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  }

});

export default generateImageModel;
