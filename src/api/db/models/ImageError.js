import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } from '../../auth/roles.js';
import MongoPaging from 'mongo-cursor-pagination';
import crypto from 'node:crypto';
import { ImageError } from '../schemas/ImageError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';
import SQS from '@aws-sdk/client-sqs';
import S3 from '@aws-sdk/client-s3';

export class ImageErrorModel {
  static async countImageErrors(input) {
    const res = await ImageError.aggregate([
      { '$match': { 'batch': input.batch } },
      { $count: 'count' }
    ]);
    return res[0] ? res[0].count : 0;
  }

  static async queryByFilter(input) {
    try {
      const result = await MongoPaging.aggregate(ImageError.collection, {
        aggregation: [
          { '$match': { 'batch': input.filters.batch } }
        ],
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous
      });
      console.log('res: ', JSON.stringify(result));
      return result;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createError(input) {
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
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async clearErrors(input) {
    const operation = async (input) => {
      return await retry(async () => {
        return await ImageError.deleteMany(input);
      }, { retries: 2 });
    };

    try {
      await operation({
        batch: input.batch
      });

      return { message: 'Cleared' };
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
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }
}

const generateImageErrorModel = ({ user } = {}) => ({
  countImageErrors: ImageErrorModel.countImageErrors,
  queryByFilter: ImageErrorModel.queryByFilter,

  get createError() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return ImageErrorModel.createError;
  },

  get clearErrors() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return ImageErrorModel.clearErrors;
  },

  get export() {
    if (!hasRole(user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return ImageErrorModel.export;
  }
});


export default generateImageErrorModel;
