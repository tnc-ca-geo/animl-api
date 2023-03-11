const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { WRITE_IMAGES_ROLES } = require('../../auth/roles');
const { randomUUID } = require('crypto');
const S3 = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const Batch = require('../schemas/Batch');
const retry = require('async-retry');
const utils = require('./utils');

const generateBatchModel = ({ user } = {}) => ({
  getBatches: async (_ids) => {
    let query = { _id: { $in: _ids } };

    try {
      const batches = await Batch.find(query);
      return batches;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  queryById: async (_id) => {
    const query = { _id };
    try {
      const batch = await Batch.findOne(query);
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
          console.error('PRE', newBatch);
          await newBatch.save();
          console.error('POST', newBatch);
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
