import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { text } from 'node:stream/consumers';
import { WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } from '../../auth/roles.js';
import MongoPaging from 'mongo-cursor-pagination';
import crypto from 'node:crypto';
import { ImageError } from '../schemas/ImageError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';
import AWSLambda from '@aws-sdk/client-lambda';
import S3 from '@aws-sdk/client-s3';

const generateImageErrorModel = ({ user } = {}) => ({
  countImageErrors: async (input) => {
    const res = await ImageError.aggregate([
      { '$match': { 'batch': input.batch } },
      { $count: 'count' }
    ]);
    return res[0] ? res[0].count : 0;
  },

  queryByFilter: async (input) => {
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
  },

  get createError() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
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
    };
  },

  get clearErrors() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
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
    };
  },

  get export() {
    if (!hasRole(user, EXPORT_DATA_ROLES)) throw new ForbiddenError;
    return async (input, context) => {
      const s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
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

        const lambda = new AWSLambda.LambdaClient({ region: process.env.AWS_DEFAULT_REGION });
        const FunctionName = 'REPLACE';

        await lambda.send(new AWSLambda.InvokeCommand({
          FunctionName,
          InvocationType: 'Event',
          Payload: Buffer.from(JSON.stringify({
            filters: input.filters
          }))
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
});

export default generateImageErrorModel;
