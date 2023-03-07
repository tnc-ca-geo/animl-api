const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { WRITE_IMAGES_ROLES } = require('../../auth/roles');
const { randomUUID } = require('crypto');
const { fromTemporaryCredentials } = require('@aws-sdk/credential-providers');
const S3 = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { HttpRequest } = require('@aws-sdk/protocol-http');
const { formatUrl } = require('@aws-sdk/util-format-url');
const { parseUrl } = require('@aws-sdk/url-parser');
const { Hash } = require('@aws-sdk/hash-node');
const Batch = require('../schemas/Batch');
const retry = require('async-retry');
const utils = require('./utils');

const generateBatchModel = ({ user } = {}) => ({
  getBatches: async (_ids) => {
    let query = {};
    if (user['is_superuser']) {
      query = _ids ? { _id: { $in: _ids } } : {};
    }
    else {
      const availIds = Object.keys(user['projects']);
      const filteredIds = _ids && _ids.filter((_id) => availIds.includes(_id));
      query = { _id: { $in: (filteredIds || availIds) } };
    }

    try {
      const batches = await Batch.find(query);
      return batches;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  createBatch: async (input) => {
    const operation = async (input) => {
      return await retry(async (bail) => {
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
  },

  get createUpload() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;
    return async (input, context) => {
      try {
        const params = {
          Bucket: `animl-images-ingestion-${process.env.STAGE}`,
          Key: randomUUID(),
          ContentType: 'application/zip',
        };

        const s3 = new S3.S3Client();
        const put = new S3.PutObjectCommand(params);

        const signedUrl = await getSignedUrl(s3, put)

        return { url: signedUrl };
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  }
});

module.exports = generateBatchModel;