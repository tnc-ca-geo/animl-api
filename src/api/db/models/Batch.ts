import GraphQLError, { InternalServerError, NotFoundError } from '../../errors.js';
import MongoPaging, { AggregationOutput } from 'mongo-cursor-pagination';
import { WRITE_IMAGES_ROLES } from '../../auth/roles.js';
import { randomUUID } from 'node:crypto';
import S3 from '@aws-sdk/client-s3';
import SQS from '@aws-sdk/client-sqs';
import Lambda from '@aws-sdk/client-lambda';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DateTime } from 'luxon';
import type * as gql from '../../../@types/graphql.js';
import Batch, { BatchSchema } from '../schemas/Batch.js';
import mongoose from 'mongoose';
import BatchError, { BatchErrorSchema } from '../schemas/BatchError.js';
import retry from 'async-retry';
import { BaseAuthedModel, GenericResponse, MethodParams, roleCheck } from './utils-model.js';
import { ImageErrorModel } from './ImageError.js';
import { Context } from '../../handler.js';

export class BatchModel {
  static async queryByFilter(
    input: gql.QueryBatchesInput,
    context: Context,
  ): Promise<AggregationOutput<BatchSchemaWithErrors>> {
    try {
      const pipeline: Record<'$match', Record<string, any>>[] = [
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

      const result = await MongoPaging.aggregate<BatchSchemaWithErrors>(Batch.collection, {
        aggregation: pipeline,
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      });

      result.results = await Promise.all(
        result.results.map((batch) => BatchModel.augmentBatch(batch)),
      );

      return result;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async queryById(_id: string): Promise<mongoose.HydratedDocument<BatchSchemaWithErrors>> {
    const query = { _id: { $eq: _id } };
    try {
      const batch = await Batch.findOne<mongoose.HydratedDocument<BatchSchemaWithErrors>>(query);
      if (!batch) throw new NotFoundError('Batch not found');

      BatchModel.augmentBatch(batch as Omit<BatchSchema, 'errors'>); // Avoid conflict with errors type in BatchWithErrors

      return batch;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async augmentBatch(batch: BatchSchemaWithErrors): Promise<BatchSchemaWithErrors> {
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
          parseInt(queue.Attributes?.ApproximateNumberOfMessages!) +
          parseInt(queue.Attributes?.ApproximateNumberOfMessagesNotVisible!);
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
          parseInt(queue.Attributes?.ApproximateNumberOfMessages!) +
          parseInt(queue.Attributes?.ApproximateNumberOfMessagesNotVisible!);
      } catch (err) {
        console.error(err);
        batch.dead = null;
      }
    }

    return batch;
  }

  static async stopBatch(input: gql.StopBatchInput): Promise<GenericResponse> {
    try {
      const batch = await retry(
        (bail, attempt) => {
          if (attempt > 1) console.log(`Retrying stopBatch operation! Try #: ${attempt}`);
          return BatchModel.queryById(input.batch);
        },
        { retries: 2 },
      );

      if (batch.processingEnd) throw new NotFoundError('Stack has already terminated');
      if (batch.stoppingInitiated)
        throw new NotFoundError('Stack is already scheduled for deletion');

      batch.stoppingInitiated = DateTime.now().toJSDate();
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

  static async redriveBatch(input: gql.RedriveBatchInput): Promise<GenericResponse> {
    try {
      await retry(
        async (bail, attempt) => {
          if (attempt > 1) console.log(`Retrying redriveBatch operation! Try #: ${attempt}`);

          // Ensure the batch actually exists
          const batch = await BatchModel.queryById(input.batch!);
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

  static async updateBatch(input: gql.UpdateBatchInput): Promise<BatchSchema> {
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

  static async closeUpload(input: gql.CloseUploadInput): Promise<GenericResponse> {
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
    input: gql.CreateUploadInput,
    context: Context,
  ): Promise<gql.CreateUploadPayload> {
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

      const res: gql.CreateUploadPayload = {
        batch: batch._id,
        user: context.user.sub,
      };

      if (input.partCount) {
        const upload = await s3.send(new S3.CreateMultipartUploadCommand(params));
        res.multipartUploadId = upload.UploadId;

        const promises: Promise<string>[] = [];
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

export default class AuthedBatchModel extends BaseAuthedModel {
  queryByFilter(...args: MethodParams<typeof BatchModel.queryByFilter>) {
    return BatchModel.queryByFilter(...args);
  }

  queryById(...args: MethodParams<typeof BatchModel.queryById>) {
    return BatchModel.queryById(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  stopBatch(...args: MethodParams<typeof BatchModel.stopBatch>) {
    return BatchModel.stopBatch(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  redriveBatch(...args: MethodParams<typeof BatchModel.redriveBatch>) {
    return BatchModel.redriveBatch(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  updateBatch(...args: MethodParams<typeof BatchModel.updateBatch>) {
    return BatchModel.updateBatch(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  createUpload(...args: MethodParams<typeof BatchModel.createUpload>) {
    return BatchModel.createUpload(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  closeUpload(...args: MethodParams<typeof BatchModel.closeUpload>) {
    return BatchModel.closeUpload(...args);
  }
}

interface BatchSchemaWithErrors extends BatchSchema {
  errors?: BatchErrorSchema[];
  imageErrors?: number;
  remaining?: number | null;
  dead?: number | null;
}
