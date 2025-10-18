import _ from 'lodash';
import S3 from '@aws-sdk/client-s3';
import GraphQLError, {
  InternalServerError,
  ForbiddenError,
  DuplicateImageError,
  DuplicateLabelError,
  DBValidationError,
  NotFoundError,
  ApplyTagError,
} from '../../errors.js';
import { BulkWriteResult } from 'mongodb';
import mongoose, { HydratedDocument, UpdateWriteOpResult } from 'mongoose';
import MongoPaging, { AggregationOutput } from 'mongo-cursor-pagination';
import { TaskModel } from './Task.js';
import { ObjectSchema } from '../schemas/shared/index.js';
import Image, { ImageCommentSchema, ImageSchema } from '../schemas/Image.js';
import Project, { CameraConfigSchema } from '../schemas/Project.js';
import ImageError, { ImageErrorSchema } from '../schemas/ImageError.js';
import ImageAttempt, { ImageAttemptSchema } from '../schemas/ImageAttempt.js';
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
  EXPORT_DATA_ROLES,
  WRITE_TAGS_ROLES,
} from '../../auth/roles.js';
import {
  buildPipeline,
  buildLabelPipeline,
  mapImgToDep,
  sanitizeMetadata,
  isLabelDupe,
  createImageAttemptRecord,
  createImageRecord,
  createLabelRecord,
  reviewerLabelRecord,
  findActiveProjReg,
  isImageReviewed,
} from './utils.js';
import { idMatch } from './utils.js';
import { ProjectModel } from './Project.js';
import retry from 'async-retry';
import { BaseAuthedModel, MethodParams, roleCheck } from './utils.js';
import { Context } from '../../handler.js';
import * as gql from '../../../@types/graphql.js';
import { DateTime } from 'luxon';
import { TaskSchema } from '../schemas/Task.js';

const ObjectId = mongoose.Types.ObjectId;

// Max number of label remove operations.
// The lambda will timeout around 30,000 operations.
// This is a safe limit with a nice number.
const MAX_LABEL_REMOVE_COUNT = 25000;
const MAX_TAG_ADD_COUNT = 20000;

export class ImageModel {
  static readonly DELETE_IMAGES_BATCH_SIZE = 300;

  static async countImages(
    input: gql.QueryImagesCountInput,
    context: Pick<Context, 'user'>,
  ): Promise<number> {
    const labels = input.filters.labels;
    if (labels && labels.length === 0) {
      return 0;
    }
    const pipeline = buildPipeline(input.filters, context.user['curr_project']!);
    pipeline.push({ $count: 'count' });
    const res = await Image.aggregate(pipeline);
    return res[0] ? res[0].count : 0;
  }

  static async countImagesByLabel(
    labels: string[],
    context: Pick<Context, 'user'>,
  ): Promise<number> {
    if (labels.length === 0) {
      return 0;
    }
    const pipeline = [
      { $match: { projectId: context.user['curr_project'] } },
      ...buildLabelPipeline(labels),
      { $count: 'count' },
    ];

    const res = await Image.aggregate(pipeline);
    return res[0] ? res[0].count : 0;
  }

  static async queryById(
    _id: string,
    context: Pick<Context, 'user'>,
  ): Promise<HydratedDocument<ImageSchema>> {
    const query = !context.user['is_superuser']
      ? { _id, projectId: context.user['curr_project']! }
      : { _id };
    try {
      const image = await Image.findOne(query);
      if (!image) throw new NotFoundError('Image not found');

      return image as HydratedDocument<ImageSchema>;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async queryByFilter(
    input: gql.QueryImagesInput,
    context: Pick<Context, 'user'>,
  ): Promise<AggregationOutput<ImageSchema>> {
    try {
      const labels = input.filters.labels;
      // short circuit by returning empty results if no labels are provided
      if (labels && labels.length === 0) {
        return {
          metadata: [{ total: 0, page: 0 }],
          results: [],
          previous: null,
          hasPrevious: false,
          next: null,
          hasNext: false,
        } as AggregationOutput<ImageSchema>;
      }
      return await MongoPaging.aggregate(Image.collection, {
        aggregation: buildPipeline(input.filters, context.user['curr_project']!),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      });
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteImages(
    input: gql.DeleteImagesInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardErrorPayload> {
    try {
      // Current limit of image deletion due to constraints of s3 deleteObjects
      if (input.imageIds!.length > this.DELETE_IMAGES_BATCH_SIZE) {
        throw new Error('Cannot delete more than 300 images at a time');
      }
      const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });

      const images = await Image.find({ _id: { $in: input.imageIds! } });

      if (images.length !== 0) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          const imageRes = await Image.deleteMany(
            {
              _id: { $in: input.imageIds! },
              projectId: context.user['curr_project'],
            },
            { session: session },
          );
          const imageAttemptRes = await ImageAttempt.deleteMany(
            {
              _id: { $in: input.imageIds! },
              projectId: context.user['curr_project'],
            },
            { session: session },
          );
          const imageErrorRes = await ImageError.deleteMany(
            {
              image: { $in: input.imageIds! },
            },
            { session: session },
          );
          if (imageRes.acknowledged && imageAttemptRes.acknowledged && imageErrorRes.acknowledged) {
            // Commit the changes
            await session.commitTransaction();
          } else {
            throw new Error(
              'There was an issue deleting the images. Some or all images may not have been deleted.',
            );
          }
        } catch (error) {
          // Rollback any changes made in the database
          await session.abortTransaction();
          throw new InternalServerError(error as string);
        } finally {
          // Ending the session
          await session.endSession();
        }
      }

      const keys: { Key: string }[] = [];
      input.imageIds!.forEach((id) => {
        const image = images.find((i) => idMatch(i._id, id));
        ['medium', 'original', 'small'].forEach((size) => {
          keys.push({ Key: `${size}/${id}-${size}.${image?.fileTypeExtension || 'jpg'}` });
        });
      });
      const s3Res = await s3.send(
        new S3.DeleteObjectsCommand({
          Bucket: `animl-images-serving-${process.env.STAGE}`,
          Delete: { Objects: keys },
        }),
      );

      return {
        isOk: s3Res.Errors === undefined || s3Res.Errors.length === 0,
        errors: s3Res.Errors?.map((e) => e.toString()) ?? [],
      };
    } catch (err) {
      return {
        isOk: false,
        errors: [String(err)],
      };
    }
  }

  static async deleteImage(
    input: { imageId: string },
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    try {
      const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });

      // Ensure Image is part of a project that the user has access to
      const image = await ImageModel.queryById(input.imageId, context);

      await Promise.all(
        ['medium', 'original', 'small'].map((size) => {
          return s3.send(
            new S3.DeleteObjectCommand({
              Bucket: `animl-images-serving-${process.env.STAGE}`,
              Key: `${size}/${input.imageId}-${size}.${image.fileTypeExtension || 'jpg'}`,
            }),
          );
        }),
      );

      await Image.deleteOne({ _id: input.imageId });
      await ImageAttempt.deleteOne({ _id: input.imageId });
      await ImageError.deleteMany({ image: input.imageId });

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Creates an ImageAttempt record and Image record
   * This is called by the image-ingestion lambda when new images are detected
   * in the ingestion S3 bucket
   */
  static async createImage(
    input: gql.CreateImageInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.ImageAttempt> {
    const successfulOps: Array<{ op: string; info: { cameraId: string } }> = [];
    const errors: Error[] = [];
    const md = sanitizeMetadata(input.md);
    let projectId = 'default_project';
    let cameraId = md.serialNumber.toString(); // this will be 'unknown' if there's no SN
    let existingCam;
    let imageAttempt: Maybe<HydratedDocument<ImageAttemptSchema>>;

    try {
      // 1. create ImageAttempt record
      try {
        // NOTE: to create the record, we need go generate the image's _id,
        // which means we need to know what project it belongs to
        if (md.batchId) {
          // if it's from a batch, find the batch record, and use its projectId
          const batch = await Batch.findOne({ _id: md.batchId });
          projectId = batch!.projectId;

          // also override the serial number if that flag was set
          if (batch!.overrideSerial) {
            md.serialNumber = batch!.overrideSerial;
            cameraId = batch!.overrideSerial;
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
          console.log(
            'Image.createImage() - created new imageAttempt: ',
            JSON.stringify(imageAttempt),
          );
          await imageAttempt.save();
          console.log(
            'Image.createImage() - imageAttempt after saving: ',
            JSON.stringify(imageAttempt),
          );
        }
      } catch (err) {
        throw new InternalServerError(err instanceof Error ? err.message : String(err));
      }

      // 2. validate metadata and create Image record
      try {
        // check for errors passed in from animl-ingest (e.g. corrupted image file)
        if (input.md.errors) {
          errors.push(
            ...input.md.errors
              .filter((err: any): err is string => typeof err === 'string')
              .map((err: string) => new Error(err)),
          );
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
        if (md.imageBytes! >= 8 * 1000000) {
          errors.push(new Error('Image Size Exceed 8 MB'));
        }

        if (!errors.length) {
          console.log('validation passed, creating image record...');
          if (md.batchId) {
            // create camera config if there isn't one yet
            await ProjectModel.createCameraConfig({ projectId, cameraId }, context);
          } else if (!existingCam) {
            await CameraModel.createWirelessCamera(
              {
                projectId,
                cameraId,
                make: md.make,
                ...(md.model && { model: md.model }),
              },
              context,
            );
            successfulOps.push({ op: 'cam-created', info: { cameraId } });
          }

          // map image to deployment
          const [project] = await ProjectModel.getProjects({ _ids: [projectId] }, context);
          console.log('project associated with image: ', project);
          const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));
          if (!camConfig) throw new Error('Camera Config not found');
          console.log('camConfig associated with image: ', camConfig);
          const deployment = mapImgToDep(md, camConfig, project.timezone);

          md.deploymentId = deployment._id!;
          md.timezone = deployment.timezone;
          md.dateTimeOriginal = (md.dateTimeOriginal as DateTime<true>).setZone(
            deployment.timezone,
            {
              keepLocalTime: true,
            },
          );

          const image = await retry(
            async (bail, attempt) => {
              if (attempt > 1) console.log(`Retrying saveImage! Try #: ${attempt}`);
              const newImage = createImageRecord(md);
              return await newImage.save();
            },
            { retries: 2 },
          );
          console.log(`image successfully created: ${JSON.stringify(image)}`);
          await handleEvent({ event: 'image-added', image }, context);
          console.log('automation successfully run');
        }
      } catch (err) {
        console.error('Image Creation Error', err);

        // add any errors to the error array so that we can create ImageErrors for them
        errors.push(err as Error);

        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-created') {
            console.log(
              'Image.createImage() - an error occurred, so reversing successful cam-created operation',
            );
            // delete newly created wireless camera record
            await WirelessCamera.findOneAndDelete({ _id: op.info.cameraId });
            // find project, remove newly created cameraConfig record
            const [proj] = await ProjectModel.getProjects({ _ids: [projectId] }, context);
            proj.cameraConfigs = proj.cameraConfigs.filter(
              (camConfig) => !idMatch(camConfig._id, op.info.cameraId),
            ) as mongoose.Types.DocumentArray<CameraConfigSchema>;
            proj.save();
          }
        }
      }

      // 3. if there were errors in the array, create ImageErrors for them
      const imageErrors: ImageErrorSchema[] = [];
      if (errors.length) {
        for (let i = 0; i < errors.length; i++) {
          const err = new ImageError({
            image: md.imageId,
            batch: md.batchId,
            path: md.path || md.fileName,
            error: errors[i].message,
          });
          await err.save();
          imageErrors.push(err);
        }
      }

      return {
        ...imageAttempt.toObject(),
        errors: imageErrors,
      };
    } catch (err) {
      // Fallback catch for unforeseen errors
      console.log(`Image.createImage() ERROR on image ${md.imageId}: ${err}`);

      const msg = (err as Error).message.toLowerCase();
      const imageError = new ImageError({
        image: md.imageId,
        batch: md.batchId,
        path: md.path || md.fileName,
        error: msg,
      });
      await imageError.save();

      if (err instanceof GraphQLError) {
        throw err;
      } else if (msg.includes('duplicate')) {
        throw new DuplicateImageError(err as string);
      } else if (msg.includes('validation')) {
        throw new DBValidationError(err as string);
      } else {
        throw new InternalServerError(err as string);
      }
    }
  }

  static async deleteComment(
    input: gql.DeleteImageCommentInput,
    context: Pick<Context, 'user'>,
  ): Promise<{ comments: mongoose.Types.DocumentArray<ImageCommentSchema> }> {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      const comment = image.comments?.filter((c) => idMatch(c._id!, input.id))[0];
      if (!comment) throw new NotFoundError('Comment not found on image');

      if (comment.author !== context.user['cognito:username'] && !context.user['is_superuser']) {
        throw new ForbiddenError('Can only delete your own comments');
      }

      image.comments = image.comments.filter(
        (c) => !idMatch(c._id!, input.id),
      ) as mongoose.Types.DocumentArray<ImageCommentSchema>;

      await image.save();

      return { comments: image.comments };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateComment(
    input: gql.UpdateImageCommentInput,
    context: Pick<Context, 'user'>,
  ): Promise<{ comments: mongoose.Types.DocumentArray<ImageCommentSchema> }> {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      const comment = image.comments?.filter((c) => idMatch(c._id!, input.id))[0];
      if (!comment) throw new NotFoundError('Comment not found on image');

      if (comment.author !== context.user['cognito:username'] && !context.user['is_superuser']) {
        throw new ForbiddenError('Can only edit your own comments');
      }

      comment.comment = input.comment;

      await image.save();

      return { comments: image.comments };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createComment(
    input: gql.CreateImageCommentInput,
    context: Pick<Context, 'user'>,
  ): Promise<{ comments: mongoose.Types.DocumentArray<ImageCommentSchema> }> {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      if (!image.comments) {
        image.comments = [] as any as mongoose.Types.DocumentArray<ImageCommentSchema>;
      }

      image.comments.push({
        _id: new ObjectId(),
        author: context.user['cognito:username'],
        comment: input.comment,
      });
      await image.save();

      return { comments: image.comments };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createTags(
    input: gql.CreateImageTagsInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    console.log('ImageModel.createTags - new tag count: ', JSON.stringify(input.tags.length));
    console.time('total-time');

    try {
      console.time('creating-tags');
      const project = await ProjectModel.queryById(context.user['curr_project']);

      const images = await Image.find({
        projectId: context.user['curr_project'],
        _id: { $in: input.tags.map((t) => t.imageId) },
      });
      const imageMap = new Map(images.map((image) => [image._id, image]));

      const res = await retry(
        async () => {
          let operations = [];

          for (const tag of input.tags) {
            const image = imageMap.get(tag.imageId);
            if (!image) throw new NotFoundError('Image not found');

            const tagExists = image.tags?.some((t) => idMatch(t, tag.tagId));
            if (tagExists) continue;

            operations.push({
              updateOne: {
                filter: { _id: image._id },
                update: {
                  $push: { tags: new ObjectId(tag.tagId) },
                },
              },
            });
          }

          if (operations.length > MAX_TAG_ADD_COUNT) {
            throw new ApplyTagError(
              `Cannot add more than ${MAX_TAG_ADD_COUNT} tags at a time. Please select fewer images and try again.`,
            );
          }
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );

      console.log('ImageModel.createTags - res: ', JSON.stringify(res.getRawResponse()));
      console.timeEnd('creating-tags');
      console.timeEnd('total-time');
      return { isOk: true }; // TODO: what should we return if the BulkWrite has errors?
    } catch (err) {
      console.log(
        `Image.createTags() ERROR on images ${input.tags.map((t) => t.imageId).join(', ')}: ${err}`,
      );
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteTags(
    input: gql.DeleteImageTagsInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    console.log('ImageModel.deleteTags - tag count: ', JSON.stringify(input.tags.length));
    console.time('total-time');
    try {
      console.time('deleting-tags');

      const project = await ProjectModel.queryById(context.user['curr_project']);
      const images = await Image.find({
        projectId: context.user['curr_project'],
        _id: { $in: input.tags.map((t) => t.imageId) },
      });
      const imageMap = new Map(images.map((image) => [image._id, image]));

      const res = await retry(
        async () => {
          let operations = [];

          for (const tag of input.tags) {
            const image = imageMap.get(tag.imageId);
            if (!image) throw new NotFoundError('Image not found');

            const tagExists = image.tags?.some((t) => idMatch(t, tag.tagId));
            if (!tagExists) {
              throw new NotFoundError(`Tag ${tag.tagId} not found on image ${tag.imageId}`);
            }

            operations.push({
              updateOne: {
                filter: { _id: image._id },
                update: { $pull: { tags: new ObjectId(tag.tagId) } },
              },
            });
          }
          console.log('ImageModel.deleteTags - operations: ', JSON.stringify(operations));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      console.log('ImageModel.deleteTags - res: ', JSON.stringify(res.getRawResponse()));
      console.timeEnd('deleting-tags');
      console.timeEnd('total-time');
      return { isOk: true }; // TODO: what should we return if the BulkWrite has errors?
    } catch (err) {
      console.log(
        `Image.deleteTags() ERROR on images ${input.tags.map((t) => t.imageId).join(', ')}: ${err}`,
      );
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async countProjectTag(
    input: { tagId: string },
    context: Pick<Context, 'user'>,
  ): Promise<number> {
    try {
      const projectId = context.user['curr_project']!;
      const count = await Image.countDocuments({
        projectId: projectId,
        tags: new ObjectId(input.tagId),
      });

      return count;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteProjectTag(
    input: { tagId: string },
    context: Pick<Context, 'user'>,
  ): Promise<UpdateWriteOpResult> {
    try {
      const projectId = context.user['curr_project']!;
      const res = await Image.updateMany(
        {
          projectId: projectId,
        },
        {
          $pull: { tags: new mongoose.Types.ObjectId(input.tagId) },
        },
      );
      return res;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Finds Image records and creates new Object subdocuments on them
   * It's used by frontend when creating new empty objects and when adding
   * the first label to temporary objects (objects that users manually create via the UI)
   */
  static async createObjects(
    input: gql.CreateObjectsInput,
    context: Pick<Context, 'user'>,
  ): Promise<mongoose.mongo.BSON.Document> {
    console.log('ImageModel.createObjects - input: ', JSON.stringify(input));

    try {
      // find image, create label record
      const project = await ProjectModel.queryById(context.user['curr_project']);

      for (const o of input.objects) {
        const image = await ImageModel.queryById(o.imageId, context);

        o.object.labels = o.object.labels?.map((label) =>
          reviewerLabelRecord(project, image, label),
        ) as gql.CreateLabelInput[];
      }

      const res = await retry(
        async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying createObjects operation! Try #: ${attempt}`);
          }
          // find images, add objects, and bulk write
          const operations = input.objects.map(({ imageId, object }) => ({
            updateOne: {
              filter: { _id: imageId },
              update: { $push: { objects: object } },
            },
          }));
          console.log('ImageModel.createObjects - operations: ', JSON.stringify(operations));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      console.log(
        'ImageModel.createObjects - Image.bulkWrite() res: ',
        JSON.stringify(res.getRawResponse()),
      );
      const imageIds = [...new Set(input.objects.map((object) => object.imageId))];
      await this.updateReviewStatus(imageIds);
      return res.getRawResponse();
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Used by frontend when bboxes are adjusted or Objects are locked/unlocked
   */
  static async updateObjects(input: gql.UpdateObjectsInput): Promise<mongoose.mongo.BSON.Document> {
    console.log('ImageModel.updateObjects - input: ', JSON.stringify(input));

    try {
      const res = await retry(
        async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying updateObjects operation! Try #: ${attempt}`);
          }

          const operations = [];
          for (const update of input.updates) {
            const { imageId, objectId, diffs } = update;
            const overrides: Record<string, any> = {};
            for (const [key, newVal] of Object.entries(diffs)) {
              overrides[`objects.$[obj].${key}`] = newVal;
            }

            operations.push({
              updateOne: {
                filter: { _id: imageId },
                update: { $set: overrides },
                arrayFilters: [{ 'obj._id': new ObjectId(objectId) }],
              },
            });
          }
          console.log('ImageModel.updateObjects - operations: ', JSON.stringify(operations));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      console.log(
        'ImageModel.updateObjects - Image.bulkWrite() res: ',
        JSON.stringify(res.getRawResponse()),
      );
      const imageIds = [...new Set(input.updates.map((update) => update.imageId))];
      await this.updateReviewStatus(imageIds);
      return res.getRawResponse();
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Used by frontend when `labelsRemoved` is dispatched (right now `labelsRemoved` is
   * only called when reverting `labelsAdded`) and there is only one label left on the object,
   * or when `markedEmpty` is reverted/undone
   */
  static async deleteObjects(input: gql.DeleteObjectsInput): Promise<mongoose.mongo.BSON.Document> {
    console.log('ImageModel.deleteObjects - input: ', JSON.stringify(input));

    try {
      const res = await retry(
        async () => {
          // find images, remove objects, and bulk write
          const operations = input.objects.map(({ imageId, objectId }) => ({
            updateOne: {
              filter: { _id: imageId },
              update: { $pull: { objects: { _id: objectId } } },
            },
          }));
          console.log('ImageModel.deleteObjects - operations: ', JSON.stringify(operations));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      console.log(
        'ImageModel.deleteObjects - Image.bulkWrite() res: ',
        JSON.stringify(res.getRawResponse()),
      );
      const imageIds = [...new Set(input.objects.map((object) => object.imageId))];
      await this.updateReviewStatus(imageIds);
      return res.getRawResponse();
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * This endpoint is used only by the ML Handler and allows labels to be Upserted
   * onto the Project label list when necessary. Users cannot use this endpoint
   *
   * @param {object} input
   * @param {object} context
   */
  static async createInternalLabels(
    input: gql.CreateInternalLabelsInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    console.log('ImageModel.createInternalLabels - input: ', JSON.stringify(input));
    let successfulOps: Array<{ op: string; info: { labelId: string } }> = [];
    let projectId: string = '';

    try {
      const image = await ImageModel.queryById(input.imageId, context)
      // NOTE: this could probably be optimized to use a single bulkWrite operation
      // (see example in createLabels() below), but it's not a high priority since
      // but at most this will receive 10 labels at a time, so there's no risk of timeouts
      for (const label of input.labels) {
        const res = await retry(
          async () => {
            console.log(
              'ImageModel.createInternalLabels - creating label: ',
              JSON.stringify(label),
            );

            successfulOps = []; // reset successfulOps in case this is a retry

            (label as any).type = 'ml';

            // find image, create label record
            projectId = image.projectId;
            // TODO: Pair with Natty on the shape of the label
            if (isLabelDupe(image, label)) throw new DuplicateLabelError();

            const project = await ProjectModel.queryById(projectId);
            const labelRecord = createLabelRecord(label, label.mlModel);

            const model = await MLModelModel.queryById(labelRecord.mlModel!);
            const cats = model.categories.filter((cat) => {
              return idMatch(cat._id, labelRecord.labelId);
            });

            if (cats.length !== 1)
              throw new DBValidationError(
                'Models should always produce labels tracked in MLModels.categories',
              );
            const modelLabel = cats[0];

            // Check if Label Exists on Project and if not, add it
            if (
              !project.labels.some((l) => {
                return l.name.toLowerCase() === modelLabel.name.toLowerCase();
              })
            ) {
              await Project.findOneAndUpdate(
                {
                  _id: projectId,
                },
                [
                  { $addFields: { labelIds: '$labels._id' } },
                  {
                    $set: {
                      labels: {
                        $cond: {
                          if: { $in: [labelRecord.labelId, '$labelIds'] },
                          then: '$labels',
                          else: {
                            $concatArrays: [
                              '$labels',
                              [
                                {
                                  _id: labelRecord.labelId,
                                  name: modelLabel.name,
                                  color: modelLabel.color,
                                  ml: true,
                                },
                              ],
                            ],
                          },
                        },
                      },
                    },
                  },
                ],
                { returnDocument: 'after' },
              );
              successfulOps.push({
                op: 'project-label-created',
                info: { labelId: labelRecord.labelId },
              });
            } else {
              // If a label with the same `name` exists in the project, use the `project.label.labelId` instead
              const [label] = project.labels.filter((l) => {
                return l.name.toLowerCase() === modelLabel.name.toLowerCase();
              });
              labelRecord.labelId = label._id;

              // Ensure label.ml is set to true
              if (!label.ml) {
                label.ml = true;
                await project.save();
                successfulOps.push({
                  op: 'label-ml-field-set-true',
                  info: { labelId: labelRecord.labelId },
                });
              }
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
                _id: new ObjectId(),
                bbox: labelRecord.bbox,
                locked: false,
                labels: [labelRecord],
              });
            }
            // set image as unreviewed due to new labels
            image.reviewed = false;
            image.awaitingPrediction = false;
            await image.save();
            return { image, newLabel: labelRecord };
          },
          { retries: 2 },
        );

        console.log('ImageModel.createInternalLabels - res: ', JSON.stringify(res));
        if (label.mlModel) {
          await handleEvent(
            {
              event: 'label-added',
              label: res.newLabel,
              image: res.image,
            },
            context,
          );
        }
      }

      return { isOk: true };
    } catch (err) {
      console.log(
        `Image.createInternalLabels() ERROR on image ${input.labels
          .map(() => input.imageId)
          .join(', ')}: ${err}`,
      );

      // reverse any successful operations
      for (const op of successfulOps) {
        if (op.op === 'project-label-created') {
          // find project, remove newly created label record
          const proj = await ProjectModel.queryById(projectId);
          const labelIdx = proj.labels.findIndex((label) => idMatch(label._id, op.info.labelId));
          proj.labels.splice(labelIdx, 1);
          await proj.save();
        }
        if (op.op === 'label-ml-field-set-true') {
          // find project label, reset ml field to false
          const proj = await ProjectModel.queryById(projectId);
          const [label] = proj.labels.filter((l) => idMatch(l._id, op.info.labelId));
          label.ml = false;
          await proj.save();
        }
      }
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /*
    * This endpoint is used only by the ML Handler to lock/unlock images on the frontend to
    * prevent users from making changes to images while predictions are in progress.
    */
  static async updatePredictionStatus(
    input: gql.UpdatePredictionStatusInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    console.log('ImageModel.updatePredictionStatus - input: ', JSON.stringify(input));

    try {
      await Image.findOneAndUpdate(
        { _id: input.imageId },
        { awaitingPrediction: input.status }
      );
      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * This endpoint is only used by human reviewers editing labels via the frontend.
   * All ML-generated labels use createInternalLabels
   *
   * @param {object} input
   * @param {object} context
   */
  static async createLabels(
    input: gql.CreateLabelsInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    console.log('ImageModel.createLabels - new label count: ', JSON.stringify(input.labels.length));
    console.time('total-time');

    try {
      console.time('creating-labels');
      const project = await ProjectModel.queryById(context.user['curr_project']);

      const images = await Image.find({
        projectId: context.user['curr_project'],
        _id: { $in: input.labels.map((l) => l.imageId) },
      });
      const imageMap = new Map(images.map((image) => [image._id, image]));

      const res = await retry(
        async () => {
          let operations = [];

          for (const label of input.labels) {
            const image = imageMap.get(label.imageId);
            if (!image) throw new NotFoundError('Image not found');
            const labelRecord = reviewerLabelRecord(project, image, label);

            // find object and save label to position 0 of label array
            operations.push({
              updateOne: {
                filter: { _id: image._id },
                update: {
                  $push: { 'objects.$[obj].labels': { $each: [labelRecord], $position: 0 } },
                },
                arrayFilters: [{ 'obj._id': new ObjectId(label.objectId) }],
              },
            });
          }
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );

      console.log('ImageModel.createLabels - res: ', JSON.stringify(res.getRawResponse()));
      console.timeEnd('creating-labels');

      console.time('updating-review-status');
      const imageIds = [...new Set(input.labels.map((label) => label.imageId))];
      await this.updateReviewStatus(imageIds);
      console.timeEnd('updating-review-status');
      console.timeEnd('total-time');
      return { isOk: true }; // TODO: what should we return if the BulkWrite has errors?
    } catch (err) {
      console.log(
        `Image.createLabels() ERROR on images ${input.labels
          .map((l) => l.imageId)
          .join(', ')}: ${err}`,
      );
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Used by frontend to update label validation state
   *
   * @param {object} input
   */
  static async updateLabels(input: gql.UpdateLabelsInput): Promise<mongoose.mongo.BSON.Document> {
    console.log('ImageModel.updateLabels - input: ', JSON.stringify(input));

    try {
      const res = await retry(
        async () => {
          const operations = [];
          for (const update of input.updates) {
            const { imageId, objectId, labelId, diffs } = update;
            const overrides: Record<string, any> = {};
            for (const [key, newVal] of Object.entries(diffs)) {
              overrides[`objects.$[obj].labels.$[lbl].${key}`] = newVal;
            }
            operations.push({
              updateOne: {
                filter: { _id: imageId },
                update: { $set: overrides },
                arrayFilters: [
                  { 'obj._id': new ObjectId(objectId) },
                  { 'lbl._id': new ObjectId(labelId) },
                ],
              },
            });
          }
          console.log('ImageModel.updateLabels - operations: ', JSON.stringify(operations));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      console.log(
        'ImageModel.updateLabels - Image.bulkWrite() res: ',
        JSON.stringify(res.getRawResponse()),
      );
      const imageIds = [...new Set(input.updates.map((update) => update.imageId))];
      await this.updateReviewStatus(imageIds);
      return res.getRawResponse();
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Images.objects can be grouped into three categories depending on their
   * locked state and number of labels:
   *
   * n: total image.objects with target label
   * m: objects which only have a single label which is the target label
   * q: objects which have multiple labels and the first validated label is the target label
   * r: objects which have multiple labels and the first validated label is not the target label
   *
   * n = m + q + r
   *
   * For m, delete object
   * For q: remove label and unlock object
   * For r: remove label and do nothing
   */
  static async deleteLabelsFromImages(
    input: { labelId: string; processAsTask: boolean },
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<gql.DeleteProjectLabelPayload> {
    // All images that have at least one object which has the target label
    const allImagesWithLabel = await Image.find({
      projectId: context.user['curr_project']!,
      'objects.labels.labelId': input.labelId,
    });

    if (allImagesWithLabel === undefined || allImagesWithLabel.length === 0) {
      return { isOk: true, movingToTask: false };
    }

    const { operations, imageIds } = allImagesWithLabel.reduce(
      (outerAcc, img) => {
        const { removable, unlockable, rest } = img.objects.reduce(
          (acc, obj) => {
            // This object doesn't have the target label so skip it
            if (obj.labels.find((lbl) => lbl.labelId === input.labelId) === undefined) {
              return acc;
            }

            const firstValidated = obj.labels.find(
              (lbl) => lbl.validation && lbl.validation.validated,
            );

            if (obj.labels.length === 1 && obj.labels[0].labelId === input.labelId) {
              acc.removable.push(obj._id);
            } else if (
              obj.labels.length > 1 &&
              obj.locked === true &&
              firstValidated !== undefined &&
              firstValidated.labelId === input.labelId
            ) {
              acc.unlockable.push(obj);
            } else {
              acc.rest.push(obj._id);
            }

            return acc;
          },
          {
            removable: [] as mongoose.Types.ObjectId[],
            unlockable: [] as ObjectSchema[],
            rest: [] as mongoose.Types.ObjectId[],
          },
        );

        const removeOperation =
          removable.length > 0
            ? [
                {
                  updateOne: {
                    filter: { _id: img._id },
                    update: {
                      $pull: {
                        objects: {
                          _id: {
                            $in: removable,
                          },
                        },
                      },
                    },
                  },
                },
              ]
            : [];

        const unlockOperations = unlockable.map((obj) => {
          return {
            updateOne: {
              filter: { _id: img._id },
              update: {
                $set: { 'objects.$[obj].locked': false },
                $pull: {
                  'objects.$[obj].labels': {
                    labelId: input.labelId,
                  },
                },
              },
              arrayFilters: [{ 'obj._id': obj._id }],
            },
          };
        });

        const standardOperations = rest.map((objId) => {
          return {
            updateOne: {
              filter: { _id: img._id },
              update: {
                $pull: {
                  'objects.$[obj].labels': {
                    labelId: input.labelId,
                  },
                },
              },
              arrayFilters: [{ 'obj._id': objId }],
            },
          };
        });

        outerAcc.operations = [
          ...outerAcc.operations,
          ...removeOperation,
          ...unlockOperations,
          ...standardOperations,
        ];
        outerAcc.imageIds = [...outerAcc.imageIds, ...img._id];

        return outerAcc;
      },
      { operations: [] as any[], imageIds: [] as string[] },
    );

    if (operations.length === 0) {
      return { isOk: true, movingToTask: false };
    }

    // if we are over the limit and processAsTask is false, create async task and return early
    if (operations.length > MAX_LABEL_REMOVE_COUNT && !input.processAsTask) {
      try {
        const task = await TaskModel.create(
          {
            type: 'DeleteProjectLabel',
            projectId: context.user['curr_project']!,
            user: context.user['cognito:username'],
            config: {
              _id: input.labelId,
              processAsTask: true,
            },
          },
          context,
        );
        return { isOk: true, movingToTask: true, task };
      } catch (err) {
        return { isOk: false, movingToTask: false };
      }
    }

    // we are either over the limit and processAsTask is true
    // (so this is being called by the task handler),
    // or it's under the limit, so continue with the operation

    const res = await Image.bulkWrite(operations);
    if (!res.isOk()) {
      return {
        isOk: false,
        movingToTask: false,
      };
    }

    await this.updateReviewStatus(imageIds);

    return {
      isOk: true,
      movingToTask: false,
    };
  }

  /**
   * Apply a single label deletion operation - only to be called by deleteAnyLabels
   *
   * @param {object} image
   * @param {string} labelId
   */
  static async deleteAnyLabel(
    image: HydratedDocument<ImageSchema>,
    labelId: string,
  ): Promise<HydratedDocument<ImageSchema>> {
    function removeLabels(obj: ObjectSchema) {
      for (let lid = 0; lid < (obj.labels || []).length; lid++) {
        if (idMatch(obj.labels[lid].labelId, labelId)) {
          obj.labels.splice(lid, 1);
        }
      }
    }

    for (let oid = 0; oid < (image.objects || []).length; oid++) {
      const object = image.objects[oid];
      const firstValidLabel =
        object.labels?.find((lbl) => lbl.validation && lbl.validation.validated) || null;

      if (object.labels.length === 1 && idMatch(object.labels[0].labelId, labelId)) {
        // the object only has one label and it's the one we're removing, so delete object
        image.objects = image.objects.filter(
          (obj) => !idMatch(obj._id!, image.objects[oid]._id!),
        ) as mongoose.Types.DocumentArray<ObjectSchema>;
      } else if (object.locked && firstValidLabel && idMatch(firstValidLabel.labelId, labelId)) {
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
    await this.updateReviewStatus([image._id]);
    return image;
  }

  /**
   * Used by frontend when `labelsRemoved` is called (this is only used when reverting `labelsAdded`)
   */
  static async deleteLabels(input: gql.DeleteLabelsInput): Promise<mongoose.mongo.BSON.Document> {
    console.log('ImageModel.deleteLabels - input: ', JSON.stringify(input));

    try {
      const res = await retry(
        async () => {
          const operations = input.labels.map(({ imageId, objectId, labelId }) => ({
            updateOne: {
              filter: { _id: imageId },
              update: { $pull: { 'objects.$[obj].labels': { _id: new ObjectId(labelId) } } },
              arrayFilters: [{ 'obj._id': new ObjectId(objectId) }],
            },
          }));
          console.log('ImageModel.deleteLabels - operations: ', JSON.stringify(operations));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      console.log(
        'ImageModel.deleteLabels - Image.bulkWrite() res: ',
        JSON.stringify(res.getRawResponse()),
      );
      const imageIds = [...new Set(input.labels.map((label) => label.imageId))];
      await this.updateReviewStatus(imageIds);
      return res.getRawResponse();
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async getStatsTask(
    input: gql.QueryStatsInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return await TaskModel.create(
        {
          type: 'GetStats',
          projectId: context.user['curr_project'],
          user: context.user['cognito:username'],
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async exportAnnotationsTask(
    input: gql.ExportInput,
    context: Pick<Context, 'config' | 'user'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return TaskModel.create(
        {
          type: 'ExportAnnotations',
          projectId: context.user['curr_project'],
          user: context.user['cognito:username'],
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Used by the frontend when the user manually selects and deletes more than
   * 100 images at once
   */
  static async deleteImagesTask(
    input: gql.DeleteImagesInput,
    context: Pick<Context, 'config' | 'user'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return TaskModel.create(
        {
          type: 'DeleteImages',
          projectId: context.user['curr_project'],
          user: context.user['cognito:username'],
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Used by the frontend to delete all currently filtered images
   */
  static async deleteImagesByFilterTask(
    input: gql.DeleteImagesByFilterTaskInput,
    context: Pick<Context, 'config' | 'user'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return TaskModel.create(
        {
          type: 'DeleteImagesByFilter',
          projectId: context.user['curr_project'],
          user: context.user['cognito:username'],
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Sets timestamp offsets for multiple images in batch
   *
   * @param {object} input - Contains imageIds array and offsetMs
   * @param {object} context - User context
   */
  static async setTimestampOffsetBatch(
    input: { imageIds: string[]; offsetMs: number },
    context: Pick<Context, 'user'>,
  ): Promise<BulkWriteResult> {
    try {
      const res = await retry(
        async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying setTimestampOffsetBatch operation! Try #: ${attempt}`);
          }

          const operations = input.imageIds.map((imageId) => ({
            updateOne: {
              filter: {
                _id: imageId,
              },
              update: { $set: { dateTimeOffsetMs: input.offsetMs } },
            },
          }));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      return res;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Sets the timestamp offset for a single image
   *
   * @param {object} input - Contains imageId and offsetMs
   * @param {object} context - User context
   */
  static async setTimestampOffset(
    input: { imageId: string; offsetMs: number },
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    const result = await ImageModel.setTimestampOffsetBatch(
      { imageIds: [input.imageId], offsetMs: input.offsetMs },
      context,
    );
    return { isOk: result.modifiedCount === 1 };
  }

  /**
   * Set timestamp offset for an array of images by ID asynchronously
   */
  static async setTimestampOffsetBatchTask(
    input: gql.SetTimestampOffsetBatchTaskInput,
    context: Pick<Context, 'config' | 'user'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return TaskModel.create(
        {
          type: 'SetTimestampOffsetBatch',
          projectId: context.user['curr_project'],
          user: context.user['cognito:username'],
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Set timestamp offset for all images matching a filter
   */
  static async setTimestampOffsetByFilterTask(
    input: gql.SetTimestampOffsetByFilterTaskInput,
    context: Pick<Context, 'config' | 'user'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return TaskModel.create(
        {
          type: 'SetTimestampOffsetByFilter',
          projectId: context.user['curr_project'],
          user: context.user['cognito:username'],
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * A custom middleware-like method that is used to update the reviewed status of
   * images that should only be ran by operations that would affect the reviewed status.
   *
   * @param {Array<string>} imageIds - An array of image IDs to update.
   */
  static async updateReviewStatus(imageIds: string[]): Promise<BulkWriteResult> {
    try {
      const res = await retry(
        async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying updateReviewStatus operation! Try #: ${attempt}`);
          }

          const images = await Image.find({
            _id: { $in: imageIds },
          });

          const operations = [];
          for (const image of images) {
            const isReviewed = isImageReviewed(image);
            if (isReviewed !== image.reviewed) {
              operations.push({
                updateOne: {
                  filter: { _id: image._id },
                  update: { $set: { reviewed: isReviewed } },
                },
              });
            }
          }
          console.log('ImageModel.updateReviewStatus - operations: ', JSON.stringify(operations));
          return await Image.bulkWrite(operations);
        },
        { retries: 2 },
      );
      if (res.ok) {
        console.log(
          'ImageModel.updateReviewStatus - Image.bulkWrite() res: ',
          JSON.stringify(res.getRawResponse()),
        );
      }
      return res;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

export default class AuthedImageModel extends BaseAuthedModel {
  countImages(...args: MethodParams<typeof ImageModel.countImages>) {
    return ImageModel.countImages(...args);
  }

  queryById(...args: MethodParams<typeof ImageModel.queryById>) {
    return ImageModel.queryById(...args);
  }

  queryByFilter(...args: MethodParams<typeof ImageModel.queryByFilter>) {
    return ImageModel.queryByFilter(...args);
  }

  @roleCheck(WRITE_TAGS_ROLES)
  createTags(...args: MethodParams<typeof ImageModel.createTags>) {
    return ImageModel.createTags(...args);
  }

  @roleCheck(WRITE_TAGS_ROLES)
  deleteTags(...args: MethodParams<typeof ImageModel.deleteTags>) {
    return ImageModel.deleteTags(...args);
  }

  @roleCheck(WRITE_COMMENTS_ROLES)
  createComment(...args: MethodParams<typeof ImageModel.createComment>) {
    return ImageModel.createComment(...args);
  }

  @roleCheck(WRITE_COMMENTS_ROLES)
  updateComment(...args: MethodParams<typeof ImageModel.updateComment>) {
    return ImageModel.updateComment(...args);
  }

  @roleCheck(WRITE_COMMENTS_ROLES)
  deleteComment(...args: MethodParams<typeof ImageModel.deleteComment>) {
    return ImageModel.deleteComment(...args);
  }

  @roleCheck(DELETE_IMAGES_ROLES)
  deleteImage(...args: MethodParams<typeof ImageModel.deleteImage>) {
    return ImageModel.deleteImage(...args);
  }

  @roleCheck(DELETE_IMAGES_ROLES)
  deleteImages(...args: MethodParams<typeof ImageModel.deleteImages>) {
    return ImageModel.deleteImages(...args);
  }

  @roleCheck(DELETE_IMAGES_ROLES)
  deleteImagesTask(...args: MethodParams<typeof ImageModel.deleteImagesTask>) {
    return ImageModel.deleteImagesTask(...args);
  }

  @roleCheck(DELETE_IMAGES_ROLES)
  deleteImagesByFilterTask(...args: MethodParams<typeof ImageModel.deleteImagesByFilterTask>) {
    return ImageModel.deleteImagesByFilterTask(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  setTimestampOffsetBatchTask(...args: MethodParams<typeof ImageModel.setTimestampOffsetBatchTask>) {
    return ImageModel.setTimestampOffsetBatchTask(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  setTimestampOffsetByFilterTask(...args: MethodParams<typeof ImageModel.setTimestampOffsetByFilterTask>) {
    return ImageModel.setTimestampOffsetByFilterTask(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  createImage(...args: MethodParams<typeof ImageModel.createImage>) {
    return ImageModel.createImage(...args);
  }

  @roleCheck(WRITE_OBJECTS_ROLES)
  createObjects(...args: MethodParams<typeof ImageModel.createObjects>) {
    return ImageModel.createObjects(...args);
  }

  @roleCheck(WRITE_OBJECTS_ROLES)
  updateObjects(...args: MethodParams<typeof ImageModel.updateObjects>) {
    return ImageModel.updateObjects(...args);
  }

  @roleCheck(WRITE_OBJECTS_ROLES)
  deleteObjects(...args: MethodParams<typeof ImageModel.deleteObjects>) {
    return ImageModel.deleteObjects(...args);
  }

  createInternalLabels(...args: MethodParams<typeof ImageModel.createInternalLabels>) {
    if (!this.user.is_superuser) throw new ForbiddenError();
    return ImageModel.createInternalLabels(...args);
  }

  updatePredictionStatus(...args: MethodParams<typeof ImageModel.updatePredictionStatus>) {
    if (!this.user.is_superuser) throw new ForbiddenError();
    return ImageModel.updatePredictionStatus(...args);
  }

  @roleCheck(WRITE_OBJECTS_ROLES)
  createLabels(...args: MethodParams<typeof ImageModel.createLabels>) {
    return ImageModel.createLabels(...args);
  }

  @roleCheck(WRITE_OBJECTS_ROLES)
  updateLabels(...args: MethodParams<typeof ImageModel.updateLabels>) {
    return ImageModel.updateLabels(...args);
  }

  @roleCheck(WRITE_OBJECTS_ROLES)
  deleteLabels(...args: MethodParams<typeof ImageModel.deleteLabels>) {
    return ImageModel.deleteLabels(...args);
  }

  getStats(...args: MethodParams<typeof ImageModel.getStatsTask>) {
    return ImageModel.getStatsTask(...args);
  }

  @roleCheck(EXPORT_DATA_ROLES)
  exportAnnotations(...args: MethodParams<typeof ImageModel.exportAnnotationsTask>) {
    return ImageModel.exportAnnotationsTask(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  setTimestampOffset(...args: MethodParams<typeof ImageModel.setTimestampOffset>) {
    return ImageModel.setTimestampOffset(...args);
  }
}
