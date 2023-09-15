import { text } from 'node:stream/consumers';
import _ from 'lodash';
import S3 from '@aws-sdk/client-s3';
import SQS from '@aws-sdk/client-sqs';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { DuplicateError, DuplicateLabelError, DBValidationError } from '../../errors.js';
import crypto from 'node:crypto';
import MongoPaging from 'mongo-cursor-pagination';
import Image from '../schemas/Image.js';
import ImageError from '../schemas/ImageError.js';
import ImageAttempt from '../schemas/ImageAttempt.js';
import WirelessCamera from '../schemas/WirelessCamera.js';
import Batch from '../schemas/Batch.js';
import { CameraModel } from './Camera.js';
import { handleEvent } from '../../../automation/index.js';
import { WRITE_OBJECTS_ROLES, WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } from '../../auth/roles.js';
import { hasRole, buildPipeline, mapImgToDep, sanitizeMetadata, isLabelDupe, createImageAttemptRecord, createImageRecord, createLabelRecord, isImageReviewed, findActiveProjReg } from './utils.js';
import { idMatch } from './utils.js';
import { ProjectModel } from './Project.js';
import retry from 'async-retry';

export class ImageModel {
  static async countImages(input, context) {
    const pipeline = buildPipeline(input.filters, context.user['curr_project']);
    pipeline.push({ $count: 'count' });
    const res = await Image.aggregate(pipeline);
    return res[0] ? res[0].count : 0;
  }

  static async queryById(_id, context) {
    const query = !context.user['is_superuser']
      ? { _id, projectId: context.user['curr_project'] }
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
  }

  static async queryByFilter(input, context) {
    try {
      const result = await MongoPaging.aggregate(Image.collection, {
        aggregation: buildPipeline(input.filters, context.user['curr_project']),
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
  }

  // TODO: this should be called getAllCategories or something like that
  static async getLabels(projId) {
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

      categories.sort();

      return { categories };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createImage(input, context) {
    const successfulOps = [];
    const errors = [];
    const md = sanitizeMetadata(input.md);
    let projectId = 'default_project';
    let cameraId = md.serialNumber.toString(); // this will be 'unknown' if there's no SN
    let existingCam;
    let imageAttempt;

    try {

      // 1. create ImageAttempt record
      try {
        // NOTE: to create the record, we need go generate the image's _id,
        // which means we need to know what project it belongs to
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
          [existingCam] = await CameraModel.getWirelessCameras([cameraId], context);
          if (existingCam) {
            projectId = findActiveProjReg(existingCam);
          }
        }

        // create an imageID
        md.projectId = projectId;
        md.imageId = projectId + ':' + md.hash;

        // create an ImageAttempt record (if one doesn't already exist)
        imageAttempt = await ImageAttempt.findOne({ _id: md.imageId });
        if (!imageAttempt) {
          imageAttempt = createImageAttemptRecord(md);
          await imageAttempt.save();
        }

      } catch (err) {
        throw new ApolloError(err);
      }

      // 2. validate metadata and create Image record
      try {

        // check for errors passed in from animl-ingest (e.g. corrupted image file)
        if (input.md.errors) {
          input.md.errors
            .filter((err) => typeof err === 'string')
            .forEach((err) => errors.push(new Error(err)));
        }

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
          console.log('validation passed, creating image record...');
          if (md.batchId) {
            // create camera config if there isn't one yet
            await ProjectModel.createCameraConfig({ projectId, cameraId }, context);
          } else if (!existingCam) {
            await CameraModel.createWirelessCamera({
              projectId,
              cameraId,
              make: md.make,
              ...(md.model && { model: md.model })
            }, context);
            successfulOps.push({ op: 'cam-created', info: { cameraId } });
          }

          // map image to deployment
          const [project] = await ProjectModel.getProjects({ _ids: [projectId] }, context);
          console.log('project associated with image: ', project);
          const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));
          console.log('camConfig associated with image: ', camConfig);
          const deployment = mapImgToDep(md, camConfig, project.timezone);

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
        // add any errors to the error array so that we can create ImageErrors for them
        errors.push(err);

        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-created') {
            console.log('Image.createImage() - an error occurred, so reversing successful cam-created operation');
            // delete newly created wireless camera record
            await WirelessCamera.findOneAndDelete({ _id: op.info.cameraId });
            // find project, remove newly created cameraConfig record
            const [proj] = await ProjectModel.getProjects({ _ids: [projectId] }, context);
            proj.cameraConfigs = proj.cameraConfigs.filter((camConfig) => !idMatch(camConfig._id, op.info.cameraId));
            proj.save();
          }
        }
      }

      // 3. if there were errors in the array, create ImageErrors for them
      if (errors.length) {
        for (let i = 0; i < errors.length; i++) {
          errors[i] = new ImageError({
            image: md.imageId,
            batch: md.batchId,
            path: md.path || md.fileName,
            error: errors[i].message
          });
          console.log(`creating ImageErrors for: ${JSON.stringify(errors[i])}`);
          await errors[i].save();
        }
      }

      // return imageAttempt
      imageAttempt.errors = errors;
      return imageAttempt;

    } catch (err) {
      // Fallback catch for unforeseen errors
      console.log(`Image.createImage() ERROR on image ${md.imageId}: ${err}`);

      const msg = err.message.toLowerCase();
      const imageError = new ImageError({
        image: md.imageId,
        batch: md.batchId,
        path: md.path || md.fileName,
        error: msg
      });
      await imageError.save();

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

  static async createObject(input, context) {
    const operation = async ({ imageId, object }) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) {
          console.log(`Retrying createObject operation! Try #: ${attempt}`);
        }

        // find image, add object, and save
        const image = await ImageModel.queryById(imageId, context);
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

  static async updateObject(input, context) {
    const operation = async ({ imageId, objectId, diffs }) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) {
          console.log(`Retrying updateObject operation! Try #: ${attempt}`);
        }
        // find image, apply object updates, and save
        const image = await ImageModel.queryById(imageId, context);
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
  }

  static async deleteObject(input, context) {
    const operation = async ({ imageId, objectId }) => {
      return await retry(async () => {

        // find image, filter out object, and save
        const image = await ImageModel.queryById(imageId, context);
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

  // TODO: make this only accept a single label at a time
  // to make dealing with errors simpler
  static async createLabels(input, context) {
    const operation = async ({ imageId, objectId, label }) => {
      return await retry(async () => {

        // find image, create label record
        const image = await ImageModel.queryById(imageId, context);
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
  }

  static async updateLabel(input, context) {
    const operation = async (input) => {
      const { imageId, objectId, labelId, diffs } = input;
      return await retry(async () => {

        // find label, apply updates, and save image
        const image = await ImageModel.queryById(imageId, context);
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
  }

  static async deleteLabel(input, context) {
    const operation = async ({ imageId, objectId, labelId }) => {
      return await retry(async () => {
        // find object, filter out label, and save image
        const image = await ImageModel.queryById(imageId, context);
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

  static async getStats(input, context) {
    let imageCount = 0;
    let reviewed = 0;
    let notReviewed = 0;
    const reviewerList = [];
    const labelList = {};
    // NOTE: just curious how many images get touched
    // by more than one reviewer. can remove later
    let multiReviewerCount = 0;

    try {
      const pipeline = buildPipeline(input.filters, context.user['curr_project']);
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
  }

  static async export(input, context) {
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
          projectId: context.user['curr_project'],
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
  }

  static async getExportStatus(input, context) {
    const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
    const bucket = context.config['/EXPORTS/EXPORTED_DATA_BUCKET'];

    try {
      const { Body } = await s3.send(new S3.GetObjectCommand({
        Bucket: bucket,
        Key: `${input.documentId}.json`
      }));

      const objectText = await text(Body);
      return JSON.parse(objectText);
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }
}

export default class AuthedImageModel {
  constructor(user) {
    this.user = user;
  }

  async countImages(input, context) {
    return await ImageModel.countImages(input, context);
  }

  async queryById(_id, context) {
    return await ImageModel.queryById(_id, context);
  }

  async queryByFilter(input, context) {
    return await ImageModel.queryByFilter(input, context);
  }

  async getLabels(projId) {
    return await ImageModel.getLabels(projId);
  }

  async createImage(input, context) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return await ImageModel.createImage(input, context);
  }

  async createObject(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.createObject(input, context);
  }

  async updateObject(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.updateObject(input, context);
  }

  async deleteObject(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.deleteObject(input, context);
  }

  // TODO: make this only accept a single label at a time
  // to make dealing with errors simpler
  async createLabels(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.createLabels(input, context);
  }

  async updateLabel(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.updateLabel(input, context);
  }

  async deleteLabel(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.deleteLabel(input, context);
  }

  async getStats(input, context) {
    return await ImageModel.getStats(input, context);
  }

  async export(input, context) {
    if (!hasRole(this.user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return await ImageModel.export(input, context);
  }

  async getExportStatus(input, context) {
    if (!hasRole(this.user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return await ImageModel.getExportStatus(input, context);
  }

}
