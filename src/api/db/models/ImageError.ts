import GraphQLError, { InternalServerError, ForbiddenError, AuthenticationError } from '../../errors.js';
import { InferSchemaType } from 'mongoose';
import { User } from '../../auth/authorization.js';
import { WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } from '../../auth/roles.js';
import MongoPaging from 'mongo-cursor-pagination';
import crypto from 'node:crypto';
import ImageError from '../schemas/ImageError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';
import SQS from '@aws-sdk/client-sqs';
import S3 from '@aws-sdk/client-s3';

export type ExportOutput = {
  documentId: string
}

/**
 * ImageErrors are errors that are generated when a single image upload
 * fails. They can either be associated with a batch or be a single image upload
 * @class
 */
export class ImageErrorModel {
  /**
   * Count all errors associated with a given batch
   *
   * @param {Object} input
   * @param {String} input.batch
   */
  static async countImageErrors(input): Promise<number> {
    const res = await ImageError.aggregate([
      { '$match': { 'batch': input.batch } },
      { '$count': 'count' }
    ]);
    return res[0] ? res[0].count : 0;
  }

  /**
   * Query Image Errors by Filter, returning a paged list of errors
   *
   * @param {Object} input
   * @param {String} input.batch
   * @param {String} input.limit
   * @param {String} input.paginatedField
   * @param {String} input.sortAscending
   * @param {String} input.next
   * @param {String} input.previous
   * @param {Object} input.filters
   * @param {String} input.filters.batch
   */
  static async queryByFilter(input) {
    try {
      return await MongoPaging.aggregate(ImageError.collection, {
        aggregation: [
          { '$match': { 'batch': input.filters.batch } }
        ],
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous
      });
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }

  /**
   * Create a new ImageError
   *
   * @param {Object} input
   * @param {String} input.image
   * @param {String} input.batch
   * @param {String} input.error
   */
  static async createError(input): Promise<InferSchemaType<typeof ImageError>> {
    const operation = async (input) => {
      return await retry(async () => {
        const newImageError = new ImageError(input);
        await newImageError.save();
        return newImageError;
      }, { retries: 2 });
    };

    try {
      const imageerr = await operation({
        image: input.image,
        batch: input.batch,
        error: input.error
      });

      return {
        _id: imageerr._id,
        image: imageerr.image,
        batch: imageerr.batch,
        error: imageerr.error,
        created: imageerr.created
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }

  /**
   * Clear Image Errors associated with a given batch
   *
   * @param {Object} input
   * @param {String} input.batch
   */
  static async clearErrors(input): Promise<{ isOk: boolean }> {
    const operation = async (input) => {
      return await retry(async () => {
        return await ImageError.deleteMany(input);
      }, { retries: 2 });
    };

    try {
      await operation({
        batch: input.batch
      });

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }

  /**
   * Create a new Export of ImageErrors
   *
   * @param {Object} input
   * @param {Object} input.filters
   * @param {Object} context
   */
  static async export(input, context): Promise<ExportOutput> {
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

      await sqs.send(new SQS.SendMessageCommand({
        QueueUrl: context.config['/EXPORTS/EXPORT_QUEUE_URL'],
        MessageBody: JSON.stringify({
          type: 'ImageErrors',
          documentId: id,
          filters: input.filters,
          format: 'csv'
        })
      }));

      return {
        documentId: id
      };

    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }
}

export default class AuthedImageErrorModel {
  user: User;
  constructor(user: User) {
    if (!user) throw new AuthenticationError('Authentication failed');
    this.user = user;
  }

  async countImageErrors(input): Promise<number> {
    return await ImageErrorModel.countImageErrors(input);
  }

  async queryByFilter(input) {
    return await ImageErrorModel.queryByFilter(input);
  }

  async createError(input): Promise<InferSchemaType<typeof ImageError>> {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError();
    return await ImageErrorModel.createError(input);
  }

  async clearErrors(input): Promise<{ isOk: boolean }> {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError();
    return await ImageErrorModel.clearErrors(input);
  }

  async export(input, context): Promise<ExportOutput> {
    if (!hasRole(this.user, EXPORT_DATA_ROLES)) throw new ForbiddenError();
    return await ImageErrorModel.export(input, context);
  }
}
