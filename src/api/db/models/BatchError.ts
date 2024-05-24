import GraphQLError, { InternalServerError } from '../../errors.js';
import { WRITE_IMAGES_ROLES } from '../../auth/roles.js';
import BatchError from '../schemas/BatchError.js';
import retry from 'async-retry';
import { BaseAuthedModel, MethodParams, roleCheck } from './utils.js';

/**
 * BatchErrors are errors that are generated when an uploaded Zip fails
 * before it can be processed into it's individual images
 * @class
 */
export class BatchErrorModel {
  /**
   * Create a new Batch Error
   *
   * @param {Object} input
   * @param {String} input.batch
   * @param {String} input.error
   */
  static async createError(input: { batch: string; error: string }) {
    try {
      const batcherr = await retry(
        async () => {
          const newBatchError = new BatchError({
            batch: input.batch,
            error: input.error,
          });
          await newBatchError.save();
          return newBatchError;
        },
        { retries: 2 },
      );

      return {
        _id: batcherr._id,
        batch: batcherr.batch,
        error: batcherr.error,
        created: batcherr.created,
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Create all errors associated with a given batch
   *
   * @param {Object} input
   * @param {String} input.batch
   */
  static async clearErrors(input: { batch: string }) {
    try {
      await retry(
        async () => {
          return await BatchError.deleteMany({
            batch: input.batch,
          });
        },
        { retries: 2 },
      );

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

export default class AuthedBatchErrorModel extends BaseAuthedModel {
  @roleCheck(WRITE_IMAGES_ROLES)
  async createError(...args: MethodParams<typeof BatchErrorModel.createError>) {
    return await BatchErrorModel.createError(...args);
  }

  @roleCheck(WRITE_IMAGES_ROLES)
  async clearErrors(...args: MethodParams<typeof BatchErrorModel.clearErrors>) {
    return await BatchErrorModel.clearErrors(...args);
  }
}
