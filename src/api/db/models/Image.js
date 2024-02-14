import { text } from 'node:stream/consumers';
import randomColor from './colors.js';
import _ from 'lodash';
import S3 from '@aws-sdk/client-s3';
import SQS from '@aws-sdk/client-sqs';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { DuplicateError, DuplicateLabelError, DBValidationError, NotFoundError } from '../../errors.js';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';
import Image from '../schemas/Image.js';
import ImageError from '../schemas/ImageError.js';
import ImageAttempt from '../schemas/ImageAttempt.js';
import WirelessCamera from '../schemas/WirelessCamera.js';
import Batch from '../schemas/Batch.js';
import { CameraModel } from './Camera.js';
import { MLModelModel } from './MLModel.js';
import { handleEvent } from '../../../automation/index.js';
import {
  DELETE_IMAGES_ROLES,
  WRITE_OBJECTS_ROLES,
  WRITE_IMAGES_ROLES,
  WRITE_COMMENTS_ROLES,
  EXPORT_DATA_ROLES
} from '../../auth/roles.js';
import {
  hasRole,
  buildPipeline,
  buildLabelPipeline,
  mapImgToDep,
  sanitizeMetadata,
  isLabelDupe,
  createImageAttemptRecord,
  createImageRecord,
  createLabelRecord,
  reviewerLabelRecord,
  isImageReviewed,
  findActiveProjReg
} from './utils.js';
import { idMatch } from './utils.js';
import { ProjectModel } from './Project.js';
import retry from 'async-retry';

const ObjectId = mongoose.Types.ObjectId;

export class ImageModel {
  static async countImages(input, context) {
    const pipeline = buildPipeline(input.filters, context.user['curr_project']);
    pipeline.push({ $count: 'count' });
    const res = await Image.aggregate(pipeline);
    return res[0] ? res[0].count : 0;
  }

  static async countImagesByLabel(labels, context) {
    const pipeline = [
      { '$match': { 'projectId': context.user['curr_project'] } },
      ...buildLabelPipeline(labels),
      { $count: 'count' }
    ];

    const res = await Image.aggregate(pipeline);
    return res[0] ? res[0].count : 0;
  }

  static async queryById(_id, context) {
    const query = !context.user['is_superuser']
      ? { _id, projectId: context.user['curr_project'] }
      : { _id };
    try {
      const image = await Image.findOne(query);
      if (!image) throw new NotFoundError('Image not found');

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

  static async deleteImages(input, context) {
    try {
      const res = await Promise.allSettled(input.imageIds.map((imageId) => {
        return this.deleteImage({ imageId }, context);
      }));

      const errors = res
        .filter((r) => { return r.status === 'rejected'; })
        .map((r) => { return r.reason; }); // Will always be an ApolloError

      return {
        message: 'Images Deleted',
        errors
      };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async deleteImage(input, context) {
    try {
      const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });

      // Ensure Image is part of a project that the user has access to
      const image = await ImageModel.queryById(input.imageId, context);

      await Promise.all(['medium', 'original', 'small'].map((size) => {
        return s3.send(new S3.DeleteObjectCommand({
          Bucket: `animl-images-serving-${process.env.STAGE}`,
          Key: `${size}/${input.imageId}-${size}.${image.fileTypeExtension || 'jpg'}`
        }));
      }));

      await Image.deleteOne({ _id: input.imageId });
      await ImageAttempt.deleteOne({ _id: input.imageId });
      await ImageError.deleteMany({ image: input.imageId });

      return { message: 'Image Deleted' };
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
          [existingCam] = await CameraModel.getWirelessCameras({ _ids: [cameraId] }, context);
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
          console.log('automation successfully run');
        }
      } catch (err) {
        console.error('Image Creation Error', err);

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
        console.log(`${errors.length} Image Errors being created`);
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

  static async deleteComment(input, context) {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      const comment = (image.comments || []).filter((c) => { return idMatch(c._id, input.id); })[0];
      if (!comment) throw new NotFoundError('Comment not found on image');

      if (comment.author !== context.user['cognito:username'] && !context.user['is_superuser']) {
        throw new ForbiddenError('Can only edit your own comments');
      }

      image.comments = image.comments.filter((c) => { return !idMatch(c._id, input.id); });

      await image.save();

      return { comments: image.comments };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async updateComment(input, context) {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      const comment = (image.comments || []).filter((c) => { return idMatch(c._id, input.id); })[0];
      if (!comment) throw new NotFoundError('Comment not found on image');

      if (comment.author !== context.user['cognito:username'] && !context.user['is_superuser']) {
        throw new ForbiddenError('Can only edit your own comments');
      }

      comment.comment = input.comment;

      await image.save();

      return { comments: image.comments };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createComment(input, context) {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      if (!image.comments) image.comments = [];
      image.comments.push({
        author: context.user['cognito:username'],
        comment: input.comment
      });
      await image.save();

      return { comments: image.comments };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createObjects(input, context) {
    const operation = async ({ objects }) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) {
          console.log(`Retrying createObjects operation! Try #: ${attempt}`);
        }
        // find images, add objects, and bulk write
        const operations = objects.map(({ imageId, object }) => ({
          updateOne: {
            filter: { _id: imageId },
            update: { $push: { objects: object } }
          }
        }));
        console.log('ImageModel.createObjects - operations: ', JSON.stringify(operations));
        return await Image.bulkWrite(operations);
      }, { retries: 2 });
    };

    try {
      // find image, create label record
      const project = await ProjectModel.queryById(context.user['curr_project']);

      for (let oid = 0; oid < input.objects.length; oid++) {
        const image = await ImageModel.queryById(input.objects[oid].imageId, context);

        for (let lid = 0; lid < (input.objects[oid].labels || []).length; lid++) {
          input.objects[oid].labels[lid] = reviewerLabelRecord(project, image, input.objects[oid].labels[lid]);
        }
      }


      const res = await operation(input);
      console.log('ImageModel.createObjects - Image.bulkWrite() res: ', JSON.stringify(res.getRawResponse()));
      return res.getRawResponse();
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async updateObjects(input) {
    console.log('ImageModel.updateObjects - input: ', JSON.stringify(input));
    const operation = async ({ updates }) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) {
          console.log(`Retrying updateObjects operation! Try #: ${attempt}`);
        }

        const operations = [];
        for (const update of updates) {
          const { imageId, objectId, diffs } = update;
          const overrides = {};
          for (const [key, newVal] of Object.entries(diffs)) {
            overrides[`objects.$[obj].${key}`] = newVal;
          }
          operations.push({
            updateOne: {
              filter: { _id: imageId },
              update: { $set: overrides },
              arrayFilters: [{ 'obj._id': new ObjectId(objectId) }]
            }
          });
        }
        console.log('ImageModel.updateObjects - operations: ', JSON.stringify(operations));
        return await Image.bulkWrite(operations);

      }, { retries: 2 });
    };

    try {
      const res = await operation(input);
      console.log('ImageModel.updateObjects - Image.bulkWrite() res: ', JSON.stringify(res.getRawResponse()));
      return res.getRawResponse();
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async deleteObjects(input) {
    const operation = async ({ objects }) => {
      return await retry(async () => {
        // find images, remove objects, and bulk write
        const operations = objects.map(({ imageId, objectId }) => ({
          updateOne: {
            filter: { _id: imageId },
            update: { $pull: { objects: { _id: objectId } } }
          }
        }));
        console.log('ImageModel.deleteObjects - operations: ', JSON.stringify(operations));
        return await Image.bulkWrite(operations);
      }, { retries: 2 });
    };

    try {
      const res = await operation(input);
      console.log('ImageModel.deleteObjects - Image.bulkWrite() res: ', JSON.stringify(res.getRawResponse()));
      return res.getRawResponse();
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  /**
   * This endpoint is used only by the ML Handler and allows labels to be Upserted
   * onto the Project label list when necessary. Users cannot use this endpoint
   *
   * @param {object} input
   * @param {object} context
   */
  static async createInternalLabels(input, context) {
    console.log('ImageModel.createInternalLabels - input: ', JSON.stringify(input));
    const operation = async ({ label }) => {
      return await retry(async () => {
        console.log('ImageModel.createInternalLabels - creating label: ', JSON.stringify(label));

        label.type = 'ml';

        // find image, create label record
        const image = await ImageModel.queryById(label.imageId, context);
        if (isLabelDupe(image, label)) throw new DuplicateLabelError();

        const project = await ProjectModel.queryById(image.projectId);
        const labelRecord = createLabelRecord(label, label.mlModel);

        // Check if Label Exists on Project and if not, add it
        if (!project.labels.some((l) => { return idMatch(l._id, labelRecord.labelId); })) {
          const model = await MLModelModel.queryById(labelRecord.mlModel);

          const cats = model.categories.filter((cat) => { return idMatch(cat._id, labelRecord.labelId); });

          project.labels.push({
            _id: labelRecord.labelId,
            source: labelRecord.mlModel,
            name: labelRecord.labelId,
            // This should always be cats[0].color unless the category wasn't defined in the DB
            // In that case assign a random color to avoid failing and losing the inference
            color: cats.length ? cats[0].color : randomColor(project.labels)
          });
          await project.save();
        }

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

        await image.save();
        return { image, newLabel: labelRecord };
      }, { retries: 2 });
    };

    try {
      for (const label of input.labels) {
        const res = await operation({ label });
        console.log('ImageModel.createInternalLabels - res: ', JSON.stringify(res));
        if (label.mlModel) {
          await handleEvent({
            event: 'label-added',
            label: res.newLabel,
            image: res.image
          }, context);
        }
      }
      return { ok: true };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      console.log(`Image.createInternalLabels() ERROR on image ${input.imageId}: ${err}`);
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createLabels(input, context) {
    console.log('ImageModel.createLabels - input: ', JSON.stringify(input));
    const operation = async ({ label }) => {
      return await retry(async () => {
        console.log('ImageModel.createLabels - creating label: ', JSON.stringify(label));

        // find image, create label record
        const image = await ImageModel.queryById(label.imageId, context);
        const project = await ProjectModel.queryById(image.projectId);
        const labelRecord = reviewerLabelRecord(project, image, label);

        // if label.objectId was specified, find object and save label to it
        // else try to match to existing object bbox and merge label into that
        // else add new object
        if (label.objectId) {
          const object = image.objects.find((obj) => idMatch(obj._id, label.objectId));
          object.labels.unshift(labelRecord);
        } else {
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
      for (const label of input.labels) {
        const res = await operation({ label });
        console.log('ImageModel.createLabels - res: ', JSON.stringify(res));
        if (label.mlModel) {
          await handleEvent({
            event: 'label-added',
            label: res.newLabel,
            image: res.image
          }, context);
        }
      }
      return { ok: true };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      console.log(`Image.createLabels() ERROR on image ${input.imageId}: ${err}`);
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async updateLabels(input) {
    console.log('ImageModel.updateLabels - input: ', JSON.stringify(input));
    const operation = async ({ updates }) => {
      return await retry(async () => {

        const operations = [];
        for (const update of updates) {
          const { imageId, objectId, labelId, diffs } = update;
          const overrides = {};
          for (const [key, newVal] of Object.entries(diffs)) {
            overrides[`objects.$[obj].labels.$[lbl].${key}`] = newVal;
          }
          operations.push({
            updateOne: {
              filter: { _id: imageId },
              update: { $set: overrides },
              arrayFilters: [
                { 'obj._id': new ObjectId(objectId) },
                { 'lbl._id': new ObjectId(labelId) }
              ]
            }
          });
        }
        console.log('ImageModel.updateLabels - operations: ', JSON.stringify(operations));
        return await Image.bulkWrite(operations);

      }, { retries: 2 });
    };

    try {
      const res = await operation(input);
      console.log('ImageModel.updateLabels - Image.bulkWrite() res: ', JSON.stringify(res.getRawResponse()));
      return res.getRawResponse();
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  /**
   * A slower but more thorough label deletion method than ImageModel.deleteLabels
   * This method iterates through all objects and deletes all instances of a given label
   * unlocking an object if the label is the current top level choice of a validated object
   * or deleting the object if it only has a single label and it's the one we're removing
   *
   * @param {object} input
   * @param {string} input.labelId - Label to remove
   * @param {object} context
   */
  static async deleteAnyLabels(input, context) {
    const images = await Image.find({
      'objects.labels.labelId': input.labelId,
      'projectId': context.user['curr_project']
    });

    return await Promise.all(images.map((image) => {
      return ImageModel.deleteAnyLabel(image, input.labelId);
    }));
  }

  /**
   * Apply a single label deletion operation - only to be called by deleteAnyLabels
   *
   * @param {object} image
   * @param {string} labelId
   */
  static async deleteAnyLabel(image, labelId) {

    function removeLabels(obj) {
      for (let lid = 0; lid < (obj.labels || []).length; lid++) {
        if (idMatch(obj.labels[lid].labelId , labelId)) {
          obj.labels.splice(lid, 1);
        }
      }
    }

    for (let oid = 0; oid < (image.objects || []).length; oid++) {
      const object = image.objects[oid];
      const firstValidLabel = object.labels?.find((lbl) => lbl.validation && lbl.validation.validated) || null;

      if (object.labels.length === 1 && idMatch(object.labels[0].labelId, labelId)) {
        // the object only has one label and it's the one we're removing, so delete object
        image.objects = image.objects.filter((obj) => !idMatch(obj._id, image.objects[oid]._id));
      } else if (object.locked && (firstValidLabel && idMatch(firstValidLabel.labelId, labelId))) {
        // the object is locked and the first validated label is one of the labels we're removing,
        // so delete label(s) and unlock the object
        object.locked = false;
        removeLabels(object);
      } else {
        // delete labels
        removeLabels(object);
      }

    }

    await image.save();
    return image;
  }

  static async deleteLabels(input) {
    console.log('ImageModel.deleteLabels - input: ', JSON.stringify(input));
    const operation = async ({ labels }) => {
      return await retry(async () => {
        const operations = labels.map(({ imageId, objectId, labelId }) => ({
          updateOne: {
            filter: { _id: imageId },
            update: { $pull: { 'objects.$[obj].labels': { _id: new ObjectId(labelId) } } },
            arrayFilters: [{ 'obj._id': new ObjectId(objectId) }]
          }
        }));
        console.log('ImageModel.deleteLabels - operations: ', JSON.stringify(operations));
        return await Image.bulkWrite(operations);
      }, { retries: 2 });
    };

    try {
      const res = await operation(input);
      console.log('ImageModel.deleteLabels - Image.bulkWrite() res: ', JSON.stringify(res.getRawResponse()));
      return res.getRawResponse();
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
      const project = await ProjectModel.queryById(context.user['curr_project']);
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
          const usr = reviewerList.find((reviewer) => idMatch(reviewer.userId, userId));
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
              const projLabel = project.labels.find((lbl) => idMatch(lbl._id, firstValidLabel.labelId));
              const labelName = projLabel?.name || 'ERROR FINDING LABEL';
              labelList[labelName] = Object.prototype.hasOwnProperty.call(labelList, labelName) ? labelList[labelName] + 1 : 1;
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

  async createComment(input, context) {
    if (!hasRole(this.user, WRITE_COMMENTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.createComment(input, context);
  }

  async updateComment(input, context) {
    if (!hasRole(this.user, WRITE_COMMENTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.updateComment(input, context);
  }

  async deleteComment(input, context) {
    if (!hasRole(this.user, WRITE_COMMENTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.deleteComment(input, context);
  }

  async deleteImage(input, context) {
    if (!hasRole(this.user, DELETE_IMAGES_ROLES)) throw new ForbiddenError;
    return await ImageModel.deleteImage(input, context);
  }

  async deleteImages(input, context) {
    if (!hasRole(this.user, DELETE_IMAGES_ROLES)) throw new ForbiddenError;
    return await ImageModel.deleteImages(input, context);
  }

  async createImage(input, context) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return await ImageModel.createImage(input, context);
  }

  async createObjects(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.createObjects(input, context);
  }

  async updateObjects(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.updateObjects(input, context);
  }

  async deleteObjects(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.deleteObjects(input, context);
  }

  async createInternalLabels(input, context) {
    if (!this.user.is_superuser) throw new ForbiddenError;
    return await ImageModel.createInternalLabels(input, context);
  }

  async createLabels(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.createLabels(input, context);
  }

  async updateLabels(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.updateLabels(input, context);
  }

  async deleteLabels(input, context) {
    if (!hasRole(this.user, WRITE_OBJECTS_ROLES)) throw new ForbiddenError;
    return await ImageModel.deleteLabels(input, context);
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
