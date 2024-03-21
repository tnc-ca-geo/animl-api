import GraphQLError, { InternalServerError, ForbiddenError, AuthenticationError } from '../../errors.js';
import { TaskModel } from './Task.js';
import { WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } from '../../auth/roles.js';
import MongoPaging from 'mongo-cursor-pagination';
import ImageError from '../schemas/ImageError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';

/**
 * ImageErrors are errors that are generated when a single image upload
 * fails. They can either be associated with a batch or be a single image upload
 * @class
 */
export class ImageErrorModel {
  /**
   * Count all errors associated with a given batch
   *
   * @param {Object} input
   * @param {String} input.batch
   */
  static async countImageErrors(input) {
    const res = await ImageError.aggregate([
      { '$match': { 'batch': input.batch } },
      { '$count': 'count' }
    ]);
    return res[0] ? res[0].count : 0;
  }

  /**
   * Query Image Errors by Filter, returning a paged list of errors
   *
   * @param {Object} input
   * @param {String} input.batch
   * @param {String} input.limit
   * @param {String} input.paginatedField
   * @param {String} input.sortAscending
   * @param {String} input.next
   * @param {String} input.previous
   * @param {Object} input.filters
   * @param {String} input.filters.batch
   */
  static async queryByFilter(input) {
    try {
      return await MongoPaging.aggregate(ImageError.collection, {
        aggregation: [
          { '$match': { 'batch': input.filters.batch } }
        ],
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous
      });
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }

  /**
   * Create a new ImageError
   *
   * @param {Object} input
   * @param {String} input.image
   * @param {String} input.batch
   * @param {String} input.error
   */
  static async createError(input) {
    const operation = async (input) => {
      return await retry(async () => {
        const newImageError = new ImageError(input);
        await newImageError.save();
        return newImageError;
      }, { retries: 2 });
    };

    try {
      const imageerr = await operation({
        image: input.image,
        batch: input.batch,
        error: input.error
      });

      return {
        _id: imageerr._id,
        image: imageerr.image,
        batch: imageerr.batch,
        error: imageerr.error,
        created: imageerr.created
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err);
    }
  }

  /**
   * Clear Image Errors associated with a given batch
   *
   * @param {Object} input
   * @param {String} input.batch
   */
  static async clearErrors(input) {
    const operation = async (input) => {
      return await retry(async () => {
        return await ImageError.deleteMany(input);
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

  /**
   * Create a new Export of ImageErrors
   *
   * @param {Object} input
   * @param {Object} input.filters
   * @param {Object} context
   */
  static async export(input, context) {
    return await TaskModel.create({
      type: 'ImageErrorExport',
      projectId: context.user['curr_project'],
      user: context.user.sub,
      config: {
        filters: input.filters,
        format: 'csv'
      }
    }, context);
  } catch (err) {
    if (err instanceof GraphQLError) throw err;
    throw new InternalServerError(err);
  }
}

export default class AuthedImageErrorModel {
  constructor(user) {
    if (!user) throw new AuthenticationError('Authentication failed');
    this.user = user;
  }

  async countImageErrors(input) {
    return await ImageErrorModel.countImageErrors(input);
  }

  async queryByFilter(input) {
    return await ImageErrorModel.queryByFilter(input);
  }

  async createError(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError();
    return await ImageErrorModel.createError(input);
  }

  async clearErrors(input) {
    if (!hasRole(this.user, WRITE_IMAGES_ROLES)) throw new ForbiddenError();
    return await ImageErrorModel.clearErrors(input);
  }

  async export(input, context) {
    if (!hasRole(this.user, EXPORT_DATA_ROLES)) throw new ForbiddenError();
    return await ImageErrorModel.export(input, context);
  }
}
