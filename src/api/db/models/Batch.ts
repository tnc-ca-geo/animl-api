import GraphQLError, { InternalServerError, NotFoundError } from '../../errors.js';
import MongoPaging, { type AggregationOutput } from 'mongo-cursor-pagination';
import { WRITE_IMAGES_ROLES } from '../../auth/roles.js';
import { randomUUID } from 'node:crypto';
import S3 from '@aws-sdk/client-s3';
import SQS from '@aws-sdk/client-sqs';
import Lambda from '@aws-sdk/client-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DateTime } from 'luxon';
import Batch, { BatchSchema } from '../schemas/Batch.js';
import BatchError from '../schemas/BatchError.js';
import retry from 'async-retry';
import { BaseAuthedModel, Context, MethodParams, roleCheck } from './utils.js';
import { ImageErrorModel } from './ImageError.js';
import { Pagination } from './Task.js';

export class BatchModel {
  static async queryByFilter(input: Pagination<{ filter: string }>, context: Context) {
    try {
      const pipeline: Array<{ $match: Record<string, any> }> = [
        { $match: { user: context.user.sub } },
        { $match: { projectId: context.user['curr_project'] } },
      ];

      if (input.filter) {
        pipeline.push({
          $match: {
            processingEnd: { $exists: input.filter === 'COMPLETED' },
          },
        });
      }

      const result = (await MongoPaging.aggregate(Batch.collection, {
        aggregation: pipeline,
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      })) as AggregationOutput<typeof Batch.collection> & { results: any[] };

      result.results = await Promise.all(
        result.results.map((batch: BatchSchema) => BatchModel.augmentBatch(batch)),
      );

      return result;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async queryById(_id: string) {
    const query = { _id };
    try {
      const batch = await Batch.findOne(query);
      if (!batch) throw new NotFoundError('Batch not found');

      BatchModel.augmentBatch(batch);

      return batch;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async augmentBatch(input: BatchSchema) {
    let batch: BatchSchema &
      Partial<{
        remaining: number | null;
        dead: number | null;
        errors: any[];
        imageErrors: number;
      }> = input;
    batch.errors = await BatchError.aggregate([{ $match: { batch: batch._id } }]);
    batch.imageErrors = await ImageErrorModel.countImageErrors({ batch: batch._id });

    if (batch.processingEnd) {
      batch.remaining = 0;
      batch.dead = 0; // Why are we assuming dead = 0 here?
    } else {
      const sqs = new SQS.SQSClient({ region: process.env.REGION });

      try {
        const queue = await sqs.send(
          new SQS.GetQueueAttributesCommand({
            QueueUrl: `https://sqs.${process.env.REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}`,
            AttributeNames: [
              'ApproximateNumberOfMessages',
              'ApproximateNumberOfMessagesNotVisible',
            ],
          }),
        );

        batch.remaining =
          parseInt(queue.Attributes!.ApproximateNumberOfMessages!) +
          parseInt(queue.Attributes!.ApproximateNumberOfMessagesNotVisible!);
      } catch (err) {
        console.error(err);
        batch.remaining = null;
      }

      try {
        const queue = await sqs.send(
          new SQS.GetQueueAttributesCommand({
            QueueUrl: `https://sqs.${process.env.REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}-dlq`,
            AttributeNames: [
              'ApproximateNumberOfMessages',
              'ApproximateNumberOfMessagesNotVisible',
            ],
          }),
        );

        batch.dead =
          parseInt(queue.Attributes!.ApproximateNumberOfMessages!) +
          parseInt(queue.Attributes!.ApproximateNumberOfMessagesNotVisible!);
      } catch (err) {
        console.error(err);
        batch.dead = null;
      }
    }

    return batch;
  }

  static async stopBatch(input: { batch: string }) {
    try {
      const batch = await retry(
        async (bail, attempt) => {
          if (attempt > 1) console.log(`Retrying stopBatch operation! Try #: ${attempt}`);

          return await BatchModel.queryById(input.batch);
        },
        { retries: 2 },
      );

      if (batch.processingEnd) throw new NotFoundError('Stack has already terminated');
      if (batch.stoppingInitiated)
        throw new NotFoundError('Stack is already scheduled for deletion');

      batch.stoppingInitiated = DateTime.now();
      await batch.save();

      const lambda = new Lambda.LambdaClient({ region: process.env.REGION });

      await lambda.send(
        new Lambda.InvokeCommand({
          FunctionName: `IngestDelete-${process.env.STAGE}`,
          InvocationType: 'Event',
          Payload: JSON.stringify({
            batch: batch._id,
          }),
        }),
      );

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async redriveBatch(input: { batch: string }) {
    try {
      await retry(
        async (bail, attempt) => {
          if (attempt > 1) console.log(`Retrying redriveBatch operation! Try #: ${attempt}`);

          // Ensure the batch actually exists
          const batch = await BatchModel.queryById(input.batch);
          if (batch.processingEnd) throw new NotFoundError('Stack has already terminated');

          const sqs = new SQS.SQSClient({ region: process.env.REGION });

          await sqs.send(
            new SQS.StartMessageMoveTaskCommand({
              SourceArn: `arn:aws:sqs:${process.env.REGION}:${process.env.ACCOUNT}:animl-ingest-${process.env.STAGE}-${batch._id}-dlq`,
              DestinationArn: `arn:aws:sqs:${process.env.REGION}:${process.env.ACCOUNT}:animl-ingest-${process.env.STAGE}-${batch._id}`,
            }),
          );

          return batch;
        },
        { retries: 2 },
      );

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateBatch(input: Partial<BatchSchema> & Pick<BatchSchema, '_id'>) {
    try {
      return await retry(
        async (bail, attempt) => {
          if (attempt > 1) console.log(`Retrying updateBatch operation! Try #: ${attempt}`);

          // find image, apply object updates, and save
          const batch = await BatchModel.queryById(input._id);

          Object.assign(batch, input);

          await batch.save();
          return batch;
        },
        { retries: 2 },
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async closeUpload(input: {
    batchId: string;
    multipartUploadId: string;
    parts: S3.CompletedPart[];
  }) {
    try {
      const s3 = new S3.S3Client();
      await s3.send(
        new S3.CompleteMultipartUploadCommand({
          Bucket: `animl-images-ingestion-${process.env.STAGE}`,
          Key: `${input.batchId}.zip`,
          UploadId: input.multipartUploadId,
          MultipartUpload: { Parts: input.parts },
        }),
      );

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createUpload(
    input: { originalFile: string; partCount?: number },
    context: Context,
  ): Promise<BatchModelCreateUploadOutput> {
    try {
      const id = `batch-${randomUUID()}`;
      const batch = await retry(
        async () => {
          const newBatch = new Batch({
            _id: id,
            projectId: context.user['curr_project'],
            user: context.user.sub,
            originalFile: input.originalFile,
            uploadedFile: `${id}.zip`,
          });
          await newBatch.save();
          return newBatch;
        },
        { retries: 2 },
      );

      const params = {
        Bucket: `animl-images-ingestion-${process.env.STAGE}`,
        Key: `${id}.zip`,
        ContentType: 'application/zip',
      };

      const s3 = new S3.S3Client();

      const res: BatchModelCreateUploadOutput = {
        batch: batch._id,
        user: context.user.sub,
      };

      if (input.partCount) {
        const upload = await s3.send(new S3.CreateMultipartUploadCommand(params));
        res.multipartUploadId = upload.UploadId;

        const promises = [];
        for (let index = 0; index < input.partCount; index++) {
          promises.push(
            getSignedUrl(
              s3,
              new S3.UploadPartCommand({
                Bucket: `animl-images-ingestion-${process.env.STAGE}`,
                Key: `${id}.zip`,
                UploadId: upload.UploadId,
                PartNumber: index + 1,
              }),
              { expiresIn: 86400 },
            ),
          );
        }

        res.urls = await Promise.all(promises);
      } else {
        res.url = await getSignedUrl(s3, new S3.PutObjectCommand(params), { expiresIn: 86400 });
      }

      return res;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

interface BatchModelCreateUploadOutput {
  batch?: string;
  user: string;
  multipartUploadId?: string;
  url?: string;
  urls?: string[];
}

export default class AuthedBatchModel extends BaseAuthedModel {
  async queryByFilter(...args: MethodParams<typeof BatchModel.queryByFilter>) {
    return await BatchModel.queryByFilter(...args);
  }

  async queryById(...args: MethodParams<typeof BatchModel.queryById>) {
    return await BatchModel.queryById(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  async stopBatch(...args: MethodParams<typeof BatchModel.stopBatch>) {
    return await BatchModel.stopBatch(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  async redriveBatch(...args: MethodParams<typeof BatchModel.redriveBatch>) {
    return await BatchModel.redriveBatch(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  async updateBatch(...args: MethodParams<typeof BatchModel.updateBatch>) {
    return await BatchModel.updateBatch(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  async createUpload(...args: MethodParams<typeof BatchModel.createUpload>) {
    return BatchModel.createUpload(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  async closeUpload(...args: MethodParams<typeof BatchModel.closeUpload>) {
    return BatchModel.closeUpload(...args);
  }
}
