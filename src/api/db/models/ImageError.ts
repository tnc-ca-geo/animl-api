import GraphQLError, { InternalServerError } from '../../errors.js';
import { TaskModel } from './Task.js';
import { WRITE_IMAGES_ROLES, EXPORT_DATA_ROLES } from '../../auth/roles.js';
import MongoPaging, { AggregationOutput } from 'mongo-cursor-pagination';
import ImageError, { ImageErrorSchema } from '../schemas/ImageError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';
import { BaseAuthedModel, GenericResponse, MethodParams, Pagination } from './utils-model.js';
import { Context } from '../../handler.js';
import { ExportErrorsInput } from '../../../@types/graphql.js';
import { HydratedDocument } from 'mongoose';
import { TaskSchema } from '../schemas/Task.js';

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
  static async countImageErrors(input: { batch: string }): Promise<number> {
    const res = await ImageError.aggregate([
      { $match: { batch: input.batch } },
      { $count: 'count' },
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
  static async queryByFilter(
    input: Pagination<{ filters: { batch: string } }>,
  ): Promise<AggregationOutput<ImageErrorSchema>> {
    try {
      return await MongoPaging.aggregate(ImageError.collection, {
        aggregation: [{ $match: { batch: input.filters.batch } }],
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      });
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
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
  static async createError(input: {
    image: string;
    batch: string;
    error: string;
  }): Promise<Pick<ImageErrorSchema, '_id' | 'image' | 'batch' | 'error' | 'created'>> {
    try {
      const imageerr = await retry(
        async () => {
          const newImageError = new ImageError({
            image: input.image,
            batch: input.batch,
            error: input.error,
          });
          await newImageError.save();
          return newImageError;
        },
        { retries: 2 },
      );

      return {
        _id: imageerr._id,
        image: imageerr.image,
        batch: imageerr.batch,
        error: imageerr.error,
        created: imageerr.created,
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Clear Image Errors associated with a given batch
   *
   * @param {Object} input
   * @param {String} input.batch
   */
  static async clearErrors(input: { batch: string }): Promise<GenericResponse> {
    try {
      await retry(() => ImageError.deleteMany({ batch: input.batch }), { retries: 2 });

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Create a new Export of ImageErrors
   *
   * @param {Object} input
   * @param {Object} input.filters
   * @param {Object} context
   */
  static async exportErrorsTask(
    input: ExportErrorsInput,
    context: Context,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return await TaskModel.create(
        {
          type: 'ExportImageErrors',
          projectId: context.user['curr_project']!,
          user: context.user.sub,
          config: {
            filters: input.filters,
            format: 'csv',
          },
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

export default class AuthedImageErrorModel extends BaseAuthedModel {
  async countImageErrors(...args: MethodParams<typeof ImageErrorModel.countImageErrors>) {
    return await ImageErrorModel.countImageErrors(...args);
  }

  async queryByFilter(...args: MethodParams<typeof ImageErrorModel.queryByFilter>) {
    return await ImageErrorModel.queryByFilter(...args);
  }

  @hasRole(WRITE_IMAGES_ROLES)
  async createError(...args: MethodParams<typeof ImageErrorModel.createError>) {
    return await ImageErrorModel.createError(...args);
  }

  @hasRole(WRITE_IMAGES_ROLES)
  async clearErrors(...args: MethodParams<typeof ImageErrorModel.clearErrors>) {
    return await ImageErrorModel.clearErrors(...args);
  }

  @hasRole(EXPORT_DATA_ROLES)
  async exportErrors(...args: MethodParams<typeof ImageErrorModel.exportErrorsTask>) {
    return await ImageErrorModel.exportErrorsTask(...args);
  }
}
