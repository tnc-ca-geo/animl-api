const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const MongoPaging = require('mongo-cursor-pagination');
const { WRITE_IMAGES_ROLES } = require('../../auth/roles');
const { randomUUID } = require('crypto');
const S3 = require('@aws-sdk/client-s3');
const SQS = require('@aws-sdk/client-sqs');
const Lambda = require('@aws-sdk/client-lambda');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Batch = require('../schemas/Batch');
const BatchError = require('../schemas/BatchError');
const retry = require('async-retry');
const utils = require('./utils');

const generateBatchModel = ({ user } = {}) => ({
  queryByFilter: async (input) => {
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
  },

  queryById: async (_id, params = {}) => {
    const query = { _id };
    try {
      const batch = await Batch.findOne(query);

      const epipeline = [];
      epipeline.push({ '$match': { 'batch': batch._id } });
      batch.errors = await BatchError.aggregate(epipeline);

      if (params.remaining && batch.processingEnd) {
        batch.remaining = 0;
        batch.dead = 0;
      } else if (params.remaining) {
        const sqs = new SQS.SQSClient({ region: process.env.REGION });

        try {
          const queue = await sqs.send(new SQS.GetQueueAttributesCommand({
            QueueUrl: `https://sqs.${process.env.REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}.fifo`,
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
            QueueUrl: `https://sqs.${process.env.REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}-dlq.fifo`,
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
  },

  get stopBatch() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
      const operation = async (input) => {
        return await retry(async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying updateObject operation! Try #: ${attempt}`);
          }
          return await this.queryById(input._id);
        }, { retries: 2 });
      };

      try {
        const batch = await operation({
          _id: input.batch
        });
        if (batch.processingEnd) throw new Error('Stack has already terminated');

        const lambda = new Lambda.LambdaClient({ region: process.env.REGION });

        await lambda.send(new Lambda.InvokeCommand({
          FunctionName: `IngestDelete-${process.env.STAGE}`,
          InvocationType: 'Event',
          Payload: JSON.stringify({
            batch: batch._id
          })
        }));

        return {
          message: 'Batch Scheduled for Deletion'
        };
      } catch (err) {
        console.error(err);
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  getPriorityStatus: async () => {
    try {
      const sqs = new SQS.SQSClient({ region: process.env.REGION });

      const result = {};

      const queue = await sqs.send(new SQS.GetQueueAttributesCommand({
        QueueUrl: `https://sqs.${process.env.REGION}.amazonaws.com/${process.env.ACCOUNT}/inferenceQueue-${process.env.STAGE}`,
        AttributeNames: [
          'ApproximateNumberOfMessages',
          'ApproximateNumberOfMessagesNotVisible'
        ]
      }));

      result.priority = parseInt(queue.Attributes.ApproximateNumberOfMessages) + parseInt(queue.Attributes.ApproximateNumberOfMessagesNotVisible);

      // console.log('res: ', JSON.stringify(result));
      return result;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }

  },

  get updateBatch() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
      const operation = async (input) => {
        return await retry(async (bail, attempt) => {
          if (attempt > 1) {
            console.log(`Retrying updateObject operation! Try #: ${attempt}`);
          }
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
    };
  },

  get createUpload() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
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
          user: user.aud,
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
          user: user.aud,
          url: signedUrl
        };
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  }
});

module.exports = generateBatchModel;
