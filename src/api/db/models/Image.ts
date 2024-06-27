import _ from 'lodash';
import S3 from '@aws-sdk/client-s3';
import GraphQLError, {
  InternalServerError,
  ForbiddenError,
  DuplicateImageError,
  DuplicateLabelError,
  DBValidationError,
  NotFoundError,
} from '../../errors.js';
import { BulkWriteResult } from 'mongodb';
import mongoose, { HydratedDocument } from 'mongoose';
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
import { BaseAuthedModel, GenericResponse, MethodParams, roleCheck } from './utils.js';
import { Context } from '../../handler.js';
import * as gql from '../../../@types/graphql.js';
import { DateTime } from 'luxon';
import { TaskSchema } from '../schemas/Task.js';

const ObjectId = mongoose.Types.ObjectId;

export class ImageModel {
  static async countImages(input: gql.QueryImagesCountInput, context: Context): Promise<number> {
    const pipeline = buildPipeline(input.filters, context.user['curr_project']!);
    pipeline.push({ $count: 'count' });
    const res = await Image.aggregate(pipeline);
    return res[0] ? res[0].count : 0;
  }

  static async countImagesByLabel(labels: string[], context: Context): Promise<number> {
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
    context: Context,
  ): Promise<HydratedDocument<ImageSchema> & { errors: ImageErrorSchema[] }> {
    const query = !context.user['is_superuser']
      ? { _id, projectId: context.user['curr_project']! }
      : { _id };
    try {
      const image = await Image.findOne(query);
      if (!image) throw new NotFoundError('Image not found');

      const epipeline = [];
      epipeline.push({ $match: { image: image._id } });
      (image as any).errors = await ImageError.aggregate<ImageErrorSchema>(epipeline); // Avoid TS issues with collision on `image.errors` propertyF;

      return image as HydratedDocument<ImageSchema> & { errors: ImageErrorSchema[] };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async queryByFilter(
    input: gql.QueryImagesInput,
    context: Context,
  ): Promise<AggregationOutput<ImageSchema>> {
    try {
      const result = await MongoPaging.aggregate(Image.collection, {
        aggregation: buildPipeline(input.filters, context.user['curr_project']!),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      });
      // console.log('res: ', JSON.stringify(result));
      return result;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteImages(
    input: gql.DeleteImagesInput,
    context: Context,
  ): Promise<GenericResponse & { errors: string[] }> {
    try {
      const res = await Promise.allSettled(
        input.imageIds!.map((imageId) => {
          return this.deleteImage({ imageId }, context);
        }),
      );

      const errors = res
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason); // Will always be a GraphQLError

      return {
        isOk: !errors.length,
        errors,
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteImage(input: { imageId: string }, context: Context): Promise<GenericResponse> {
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

  static async createImage(
    input: gql.CreateImageInput,
    context: Context,
  ): Promise<HydratedDocument<ImageAttemptSchema> & { errors: ImageErrorSchema[] }> {
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
          await imageAttempt.save();
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
        if (md.imageBytes! >= 4 * 1000000) {
          errors.push(new Error('Image Size Exceed 4mb'));
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
      if (errors.length) {
        console.log(`${errors.length} Image Errors being created`);
        for (let i = 0; i < errors.length; i++) {
          const err = new ImageError({
            image: md.imageId,
            batch: md.batchId,
            path: md.path || md.fileName,
            error: errors[i].message,
          });
          console.log(`creating ImageErrors for: ${JSON.stringify(err)}`);
          await err.save();
          errors[i] = err as any as Error; // Hack to get around TypeScript's type checking
        }
      }

      return imageAttempt as HydratedDocument<ImageAttemptSchema> & { errors: ImageErrorSchema[] };
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
    context: Context,
  ): Promise<{ comments: mongoose.Types.DocumentArray<ImageCommentSchema> }> {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      const comment = image.comments?.filter((c) => idMatch(c._id!, input.id))[0];
      if (!comment) throw new NotFoundError('Comment not found on image');

      if (comment.author !== context.user['cognito:username'] && !context.user['is_superuser']) {
        throw new ForbiddenError('Can only edit your own comments');
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
    context: Context,
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
    context: Context,
  ): Promise<{ comments: mongoose.Types.DocumentArray<ImageCommentSchema> }> {
    try {
      const image = await ImageModel.queryById(input.imageId, context);

      if (!image.comments)
        image.comments = [] as any as mongoose.Types.DocumentArray<ImageCommentSchema>;
      image.comments.push({
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

  static async createObjects(
    input: gql.CreateObjectsInput,
    context: Context,
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
    context: Context,
  ): Promise<AlternativeGenericResponse> {
    console.log('ImageModel.createInternalLabels - input: ', JSON.stringify(input));

    try {
      for (const label of input.labels) {
        const res = await retry(
          async () => {
            console.log(
              'ImageModel.createInternalLabels - creating label: ',
              JSON.stringify(label),
            );

            (label as any).type = 'ml';

            // find image, create label record
            const image = await ImageModel.queryById(label.imageId, context);
            // TODO: Pair with Natty on the shape of the label
            if (isLabelDupe(image, label)) throw new DuplicateLabelError();

            const project = await ProjectModel.queryById(image.projectId);
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
                  _id: image.projectId,
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
            } else {
              // If a label with the same `name` exists in the project, use the `project.label.labelId` instead
              const [label] = project.labels.filter((l) => {
                return l.name.toLowerCase() === modelLabel.name.toLowerCase();
              });
              labelRecord.labelId = label._id;
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
                labels: [labelRecord],
              });
            }

            // set image as unreviewed due to new labels
            image.reviewed = false;

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
      return { ok: true };
    } catch (err) {
      console.log(
        `Image.createInternalLabels() ERROR on image ${input.labels
          .map((l) => l.imageId)
          .join(', ')}: ${err}`,
      );
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createLabels(
    input: gql.CreateLabelsInput,
    context: Context,
  ): Promise<AlternativeGenericResponse> {
    console.log('ImageModel.createLabels - input: ', JSON.stringify(input));

    try {
      for (const label of input.labels) {
        const res = await retry(
          async () => {
            console.log('ImageModel.createLabels - creating label: ', JSON.stringify(label));

            // find image, create label record
            const image = await ImageModel.queryById(label.imageId, context);
            const project = await ProjectModel.queryById(image.projectId);
            const labelRecord = reviewerLabelRecord(project, image, label);

            // if label.objectId was specified, find object and save label to it
            // else try to match to existing object bbox and merge label into that
            // else add new object
            if (label.objectId) {
              const object = image.objects.find((obj) => idMatch(obj._id!, label.objectId!));
              object?.labels.unshift(labelRecord);
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
                  labels: [labelRecord],
                });
              }
            }

            await image.save();
            return { image, newLabel: labelRecord };
          },
          { retries: 2 },
        );
        console.log('ImageModel.createLabels - res: ', JSON.stringify(res));
        if (label.mlModel) {
          // TODO: Verify this
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
      const imageIds = [...new Set(input.labels.map((label) => label.imageId))];
      await this.updateReviewStatus(imageIds);
      return { ok: true };
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
   * A slower but more thorough label deletion method than ImageModel.deleteLabels
   * This method iterates through all objects and deletes all instances of a given label
   * unlocking an object if the label is the current top level choice of a validated object
   * or deleting the object if it only has a single label and it's the one we're removing
   *
   * @param {object} input
   * @param {string} input.labelId - Label to remove
   * @param {object} context
   */
  static async deleteAnyLabels(
    input: { labelId: string },
    context: Context,
  ): Promise<HydratedDocument<ImageSchema>[]> {
    const images = await Image.find({
      'objects.labels.labelId': input.labelId,
      projectId: context.user['curr_project']!,
    });

    return await Promise.all(
      images.map((image) => {
        return ImageModel.deleteAnyLabel(image, input.labelId);
      }),
    );
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
    context: Context,
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
    context: Context,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return TaskModel.create(
        {
          type: 'ExportAnnotations',
          projectId: context.user['curr_project'],
          user: context.user['cognito:username'],
          config: {
            filters: input.filters,
            format: input.format,
          },
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
}

interface AlternativeGenericResponse {
  ok: boolean;
}
