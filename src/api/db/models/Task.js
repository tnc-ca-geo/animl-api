import GraphQLError, { InternalServerError, ForbiddenError, AuthenticationError } from '../../errors.js';
import { } from '../../auth/roles.js';
import MongoPaging from 'mongo-cursor-pagination';
import Task from '../schemas/Task.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';

/**
 * Tasks manage the state of async events (except for batch uploads) on the platform
 * @class
 */
export class TaskModel {
  /**
   * Query Tasks by Filter, returning a paged list
   *
   * @param {Object} input
   * @param {String} input.limit
   * @param {String} input.paginatedField
   * @param {String} input.sortAscending
   * @param {String} input.next
   * @param {String} input.previous
   */
  static async queryByFilter(input) {
    try {
      return await MongoPaging.aggregate(ImageError.collection, {
        aggregation: [
          { '$match': { 'user': context.user['cognito:username'] } }
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
}

export default class AuthedTaskModel {
  constructor(user) {
    if (!user) throw new AuthenticationError('Authentication failed');
    this.user = user;
  }

  async queryByFilter(input) {
    return await TaskModel.queryByFilter(input);
  }
}
