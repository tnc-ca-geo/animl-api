import { ApolloError } from 'apollo-server-errors';
import MLModel from '../schemas/MLModel.js';
import retry from 'async-retry';

const generateMLModelModel = () => ({
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
      return await retry(async () => {

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

export default generateMLModelModel;
