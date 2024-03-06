import GraphQLError, { InternalServerError, ForbiddenError, AuthenticationError } from '../../errors.js';
import { User } from '../../auth/authorization.js';
import { WRITE_IMAGES_ROLES } from '../../auth/roles.js';
import BatchError from '../schemas/BatchError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';

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
  static async createError(input) {
    const operation = async (input) => {
      return await retry(async () => {
        const newBatchError = new BatchError(input);
        await newBatchError.save();
        return newBatchError;
      }, { retries: 2 });
    };

    try {
      const batcherr = await operation({
        batch: input.batch,
        error: input.error
      });

      return {
        _id: batcherr._id,
        batch: batcherr.batch,
        error: batcherr.error,
        created: batcherr.created
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }

  /**
   * Create all errors associated with a given batch
   *
   * @param {Object} input
   * @param {String} input.batch
   */
  static async clearErrors(input) {
    const operation = async (input) => {
      return await retry(async () => {
        return await BatchError.deleteMany(input);
      }, { retries: 2 });
    };

    try {
      await operation({
        batch: input.batch
      });

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }
}

export default class AuthedBatchErrorModel {
    user: User

  constructor(user: User) {
    if (!user) throw new AuthenticationError('Authentication failed');
    this.user = user;
  }

  async createError(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError();
    return await BatchErrorModel.createError(input);
  }

  async clearErrors(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError();
    return await BatchErrorModel.clearErrors(input);
  }
}
