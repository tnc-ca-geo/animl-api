const { ApolloError } = require('apollo-server-errors');
const MLModel = require('../schemas/MLModel');
const utils = require('./utils');
const retry = require('async-retry');


const generateMLModelModel = ({ user } = {}) => ({

  getMLModels: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const mlModels = await MLModel.find(query);
      return mlModels;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  createMLModel: async (modelConfig) => {

    const operation = async (modelConfig) => {
      return await retry(async (bail) => {

        // create new ML model record and save it
        const newModel = new MLModel(modelConfig);
        await newModel.save();
        return newModel;

      }, { retries: 2 });
    };

    try {
      return await operation(modelConfig);
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

});

module.exports = generateMLModelModel;
