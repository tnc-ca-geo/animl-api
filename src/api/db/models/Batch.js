const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const MongoPaging = require('mongo-cursor-pagination');
const { WRITE_IMAGES_ROLES } = require('../../auth/roles');
const { randomUUID } = require('crypto');
const S3 = require('@aws-sdk/client-s3');
const SQS = require('@aws-sdk/client-sqs');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Batch = require('../schemas/Batch');
const retry = require('async-retry');
const utils = require('./utils');

const generateBatchModel = ({ user } = {}) => ({
  queryByFilter: async (input) => {
    try {
      const pipeline = [];
      if (input.eTag) {
        pipeline.push({ '$match': { 'eTag': input.eTag } });
      }

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

      if (params.remaining && batch.processingEnd) {
        batch.remaining = 0;
        batch.dead = 0;
      } else if (params.remaining) {
        const sqs = new SQS.SQSClient();

        try {
          const queue = await sqs.send(new SQS.GetQueueAttributesCommand({
            QueueUrl: `https://sqs.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}.fifo`,
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
            QueueUrl: `https://sqs.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${batch._id}-dlq.fifo`,
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

  get createBatch() {
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
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
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
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get createUpload() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return async () => {
      try {
        const params = {
          Bucket: `animl-images-ingestion-${process.env.STAGE}`,
          Key: randomUUID(),
          ContentType: 'application/zip'
        };

        const s3 = new S3.S3Client();
        const put = new S3.PutObjectCommand(params);

        const signedUrl = await getSignedUrl(s3, put);

        return { url: signedUrl };
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  }
});

module.exports = generateBatchModel;
