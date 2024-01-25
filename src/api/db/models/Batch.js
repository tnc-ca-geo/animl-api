import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import MongoPaging from 'mongo-cursor-pagination';
import { WRITE_IMAGES_ROLES } from '../../auth/roles.js';
import { randomUUID } from 'node:crypto';
import S3 from '@aws-sdk/client-s3';
import SQS from '@aws-sdk/client-sqs';
import Lambda from '@aws-sdk/client-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DateTime } from 'luxon';
import Batch from '../schemas/Batch.js';
import BatchError from '../schemas/BatchError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';
import { ImageErrorModel } from './ImageError.js';

export class BatchModel {
  static async queryByFilter(input, context) {

    try {
      const pipeline = [
        { '$match': { 'user': context.user.sub } },
        { '$match': { 'projectId': context.user['curr_project'] } }
      ];

      if (input.filter) {
        pipeline.push({ '$match': {
          processingEnd: { $exists: (input.filter === 'COMPLETED') }
        } });
      }

      const result = await MongoPaging.aggregate(Batch.collection, {
        aggregation: pipeline,
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous
      });

      result.results = await Promise.all(result.results.map((batch) => BatchModel.augmentBatch(batch)));

      return result;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async queryById(_id) {
    const query = { _id };
    try {
      const batch = await Batch.findOne(query);

      BatchModel.augmentBatch(batch);

      return batch;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async augmentBatch(batch) {
    batch.errors = await BatchError.aggregate([{ '$match': { 'batch': batch._id } }]);
    batch.imageErrors = await ImageErrorModel.countImageErrors({ batch: batch._id });

    if (batch.processingEnd) {
      batch.remaining = 0;
      batch.dead = 0; // Why are we assuming dead = 0 here?
    } else {
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
  }


  static async stopBatch(input) {
    const operation = async (input) => {
      return await retry(async (bail, attempt) => {
        if (attempt > 1) console.log(`Retrying stopBatch operation! Try #: ${attempt}`);

        return await BatchModel.queryById(input._id);
      }, { retries: 2 });
    };

    try {
      const batch = await operation({ _id: input.batch });
      if (batch.processingEnd) throw new ApolloError('Stack has already terminated');
      if (batch.stoppingInitiated) throw new ApolloError('Stack is already scheduled for deletion');

      batch.stoppingInitiated = DateTime.now();
      await batch.save();

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
        const batch = await BatchModel.queryById(input.batch);
        if (batch.processingEnd) throw new ApolloError('Stack has already terminated');

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
        const batch = await BatchModel.queryById(input._id);

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

  static async closeUpload(input) {
    try {
      const s3 = new S3.S3Client();
      await s3.send(new S3.CompleteMultipartUploadCommand({
        Bucket: `animl-images-ingestion-${process.env.STAGE}`,
        Key: `${input.batchId}.zip`,
        UploadId: input.multipartUploadId,
        MultipartUpload: { Parts: input.parts }
      }));

      return { message: 'Upload Closed' };
    } catch (err) {
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

      const res = {
        batch: batch._id,
        user: context.user.sub
      };

      if (input.partCount) {
        const upload = await s3.send(new S3.CreateMultipartUploadCommand(params));
        res.multipartUploadId = upload.UploadId;

        const promises = [];
        for (let index = 0; index < input.partCount; index++) {
          promises.push(getSignedUrl(s3, new S3.UploadPartCommand({
            Bucket: `animl-images-ingestion-${process.env.STAGE}`,
            Key: `${id}.zip`,
            UploadId: upload.UploadId,
            PartNumber: index + 1
          }), { expiresIn: 86400 }));
        }

        res.urls = await Promise.all(promises);
      } else {
        res.url = await getSignedUrl(s3, new S3.PutObjectCommand(params), { expiresIn: 86400 });
      }

      return res;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }
}

export default class AuthedBatchModel {
  constructor(user) {
    this.user = user;
  }

  async queryByFilter(input, context) {
    return await BatchModel.queryByFilter(input, context);
  }

  async queryById(input) {
    return await BatchModel.queryById(input);
  }

  async stopBatch(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return await BatchModel.stopBatch(input);
  }

  async redriveBatch(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return await BatchModel.redriveBatch(input);
  }

  async updateBatch(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return await BatchModel.updateBatch(input);
  }

  async createUpload(input, context) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return BatchModel.createUpload(input, context);
  }

  async closeUpload(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return BatchModel.closeUpload(input);
  }
}
