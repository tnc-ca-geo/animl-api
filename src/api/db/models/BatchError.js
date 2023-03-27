const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const BatchErrro = require('../schemas/BatchError');
const retry = require('async-retry');
const utils = require('./utils');
const { randomUUID } = require('node:crypto');

const generateBatchErrorModel = ({ user } = {}) => ({
  get createError() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
      const operation = async (input) => {
        return await retry(async () => {
          const newBatchError = new BatchError(input);
          await newBatchError.save();
          return newBatchError;
        }, { retries: 2 });
      };

      try {
        const batcherr = await operation({
            _id: randomUUID(),
            user: input.batch,
            error: input.error,
            created: new Date()
        });

        return batcherr;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  }
});

module.exports = generateBatchErrorModel;
