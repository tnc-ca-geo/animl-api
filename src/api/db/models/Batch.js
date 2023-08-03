import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import MongoPaging from 'mongo-cursor-pagination';
import { WRITE_IMAGES_ROLES } from '../../auth/roles.js';
import { randomUUID } from 'node:crypto';
import S3 from '@aws-sdk/client-s3';
import SQS from '@aws-sdk/client-sqs';
import Lambda from '@aws-sdk/client-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Batch from '../schemas/Batch.js';
import BatchError from '../schemas/BatchError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';
import { ImageErrorModel } from './ImageError.js';

export class BatchModel {
  static async queryByFilter(input) {
    try {
      const pipeline = [];
      if (input.eTag) pipeline.push({ '$match': { 'eTag': input.eTag } });
      if (input.user) pipeline.push({ '$match': { 'user': input.user } });

      const result = await MongoPaging.aggregate(Batch.collection, {
        aggregation: pipeline,
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

  static async queryById(_id, params = {}) {
    const query = { _id };
    try {
      const batch = await Batch.findOne(query);

      const epipeline = [];
      epipeline.push({ '$match': { 'batch': batch._id } });
      batch.errors = await BatchError.aggregate(epipeline);

      batch.imageErrors = await ImageErrorModel.countImageErrors({ batch: batch._id });

      if (params.remaining && batch.processingEnd) {
        batch.remaining = 0;
        batch.dead = 0;
      } else if (params.remaining) {
        const sqs = new SQS.SQSClient({ region: process.env.REGION });

        try {
          const queue = await sqs.send(new SQS.GetQueueAttributesCommand({
            QueueUrl: `https://sqs.${process.env.REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}`,
            AttributeNames: [
              'ApproximateNumberOfMessages',
              'ApproximateNumberOfMessagesNotVisible'
            ]
          }));

          batch.remaining = parseInt(queue.Attributes.ApproximateNumberOfMessages) + parseInt(queue.Attributes.ApproximateNumberOfMessagesNotVisible);
        } catch (err) {
          console.error(err);
          batch.remaining = null;
        }

        try {
          const queue = await sqs.send(new SQS.GetQueueAttributesCommand({
            QueueUrl: `https://sqs.${process.env.REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}-dlq`,
            AttributeNames: [
              'ApproximateNumberOfMessages',
              'ApproximateNumberOfMessagesNotVisible'
            ]
          }));

          batch.dead = parseInt(queue.Attributes.ApproximateNumberOfMessages) + parseInt(queue.Attributes.ApproximateNumberOfMessagesNotVisible);
        } catch (err) {
          console.error(err);
          batch.dead = null;
        }
      }

      return batch;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async stopBatch(input) {
    const operation = async (input) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) console.log(`Retrying stopBatch operation! Try #: ${attempt}`);

        return await this.queryById(input._id);
      }, { retries: 2 });
    };

    try {
      const batch = await operation({ _id: input.batch });
      if (batch.processingEnd) throw new Error('Stack has already terminated');

      const lambda = new Lambda.LambdaClient({ region: process.env.REGION });

      await lambda.send(new Lambda.InvokeCommand({
        FunctionName: `IngestDelete-${process.env.STAGE}`,
        InvocationType: 'Event',
        Payload: JSON.stringify({
          batch: batch._id
        })
      }));

      return { message: 'Batch Scheduled for Deletion' };
    } catch (err) {
      console.error(err);
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async redriveBatch(input) {
    const operation = async (input) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) console.log(`Retrying redriveBatch operation! Try #: ${attempt}`);

        // Ensure the batch actually exists
        const batch = await this.queryById(input.batch);
        if (batch.processingEnd) throw new Error('Stack has already terminated');

        const sqs = new SQS.SQSClient({ region: process.env.REGION });

        await sqs.send(new SQS.StartMessageMoveTaskCommand({
          SourceArn: `arn:aws:sqs:${process.env.REGION}:${process.env.ACCOUNT}:animl-ingest-${process.env.STAGE}-${batch._id}-dlq`,
          DestinationArn: `arn:aws:sqs:${process.env.REGION}:${process.env.ACCOUNT}:animl-ingest-${process.env.STAGE}-${batch._id}`
        }));

        return batch;

      }, { retries: 2 });
    };

    try {
      await operation(input);

      return { message: 'Batch Redrive Initiated' };
    } catch (err) {
      console.error(err);
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async updateBatch(input) {
    const operation = async (input) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) console.log(`Retrying updateBatch operation! Try #: ${attempt}`);

        // find image, apply object updates, and save
        const batch = await this.queryById(input._id);

        Object.assign(batch, input);

        await batch.save();
        return batch;

      }, { retries: 2 });
    };

    try {
      return await operation(input);
    } catch (err) {
      console.error(err);
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createUpload(input, context) {
    const operation = async (input) => {
      return await retry(async () => {
        const newBatch = new Batch(input);
        await newBatch.save();
        return newBatch;
      }, { retries: 2 });
    };

    try {
      const id = `batch-${randomUUID()}`;
      const batch = await operation({
        _id: id,
        projectId: context.user['curr_project'],
        user: context.user.sub,
        originalFile: input.originalFile,
        uploadedFile: `${id}.zip`
      });

      const params = {
        Bucket: `animl-images-ingestion-${process.env.STAGE}`,
        Key: `${id}.zip`,
        ContentType: 'application/zip'
      };

      const s3 = new S3.S3Client();
      const put = new S3.PutObjectCommand(params);

      const signedUrl = await getSignedUrl(s3, put);

      return {
        batch: batch._id,
        user: context.user.sub,
        url: signedUrl
      };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }
}

const generateBatchModel = ({ user } = {}) => ({
  queryByFilter: BatchModel.queryByFilter,
  queryById: BatchModel.queryById,

  get stopBatch() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return BatchModel.stopBatch;
  },

  get redriveBatch() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return BatchModel.redriveBatch;
  },

  get updateBatch() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return BatchModel.updateBatch;
  },

  get createUpload() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return BatchModel.createUpload;
  }
});


export default generateBatchModel;
