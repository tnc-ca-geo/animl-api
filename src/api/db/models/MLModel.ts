import GraphQLError, { InternalServerError, NotFoundError } from '../../errors.js';
import MLModel, { MLModelSchema } from '../schemas/MLModel.js';
import retry from 'async-retry';
import { BaseAuthedModel, MethodParams } from './utils.js';
import { HydratedDocument } from 'mongoose';

export class MLModelModel {
  static async queryById(_id: string): Promise<HydratedDocument<MLModelSchema>> {
    const query = { _id: { $eq: _id } };
    try {
      const model = await MLModel.findOne(query);
      if (!model) throw new NotFoundError('Model not found');

      return model;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async getMLModels(
    input: Maybe<{ _ids?: Maybe<string[]> }>,
  ): Promise<HydratedDocument<MLModelSchema>[]> {
    const query = input?._ids ? { _id: { $in: input._ids } } : {};
    try {
      const mlModels = await MLModel.find(query);
      return mlModels;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createMLModel(modelConfig: MLModelSchema): Promise<HydratedDocument<MLModelSchema>> {
    try {
      return await retry(
        async () => {
          // create new ML model record and save it
          const newModel = new MLModel(modelConfig);
          await newModel.save();
          return newModel;
        },
        { retries: 2 },
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

export default class AuthMLModelModel extends BaseAuthedModel {
  async getMLModels(...args: MethodParams<typeof MLModelModel.getMLModels>) {
    return await MLModelModel.getMLModels(...args);
  }

  async createMLModel(...args: MethodParams<typeof MLModelModel.createMLModel>) {
    return await MLModelModel.createMLModel(...args);
  }
}
