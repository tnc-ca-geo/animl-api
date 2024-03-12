import GraphQLError, { InternalServerError, ForbiddenError, AuthenticationError } from '../../errors.js';
import MongoPaging from 'mongo-cursor-pagination';
import Task from '../schemas/Task.js';
import { hasRole } from './utils.js';
import {
  READ_TASKS_ROLES
} from '../../auth/roles.js';

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
   * @param {Object} context
   */
  static async queryByFilter(input, context) {
    try {
      return await MongoPaging.aggregate(Task.collection, {
        aggregation: [
          { '$match': { 'projectId': context.user['curr_project'] } },
          { '$match': { 'user': context.user.sub } }
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

  async queryByFilter(input, context) {
    if (!hasRole(this.user, READ_TASKS_ROLES)) throw new ForbiddenError();

    return await TaskModel.queryByFilter(input, context);
  }
}
