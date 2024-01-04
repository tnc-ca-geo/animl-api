import { ApolloError } from 'apollo-server-errors';
import MLModel from '../schemas/MLModel.js';
import retry from 'async-retry';

export class MLModelModel {
  static async queryById(_id) {
    const query = { _id };
    try {
      const model = await MLModel.findOne(query);
      if (!model) throw new Error('Model not found');

      return model;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async getMLModels(input) {
    const query = input?._ids ? { _id: { $in: input._ids } } : {};
    try {
      const mlModels = await MLModel.find(query);
      return mlModels;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createMLModel(modelConfig) {
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
}

export default class AuthMLModelModel {
  constructor(user) {
    this.user = user;
  }

  async getMLModels(input) {
    return await MLModelModel.getMLModels(input);
  }

  async createMLModel(modelConfig) {
    return await MLModelModel.createMLModel(modelConfig);
  }
}
