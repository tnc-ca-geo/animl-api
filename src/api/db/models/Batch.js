const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const Batch = require('../schemas/Batch');
const retry = require('async-retry');

const generateBatchModel = ({ user } = {}) => ({
  getBatches: async (_ids) => {
    let query = {};
    if (user['is_superuser']) {
      query = _ids ? { _id: { $in: _ids } } : {};
    }
    else {
      const availIds = Object.keys(user['projects']);
      const filteredIds = _ids && _ids.filter((_id) => availIds.includes(_id));
      query = { _id: { $in: (filteredIds || availIds) }};
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
 });

module.exports = generateBatchModel;
