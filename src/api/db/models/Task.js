import GraphQLError, { NotFoundError, InternalServerError, ForbiddenError, AuthenticationError } from '../../errors.js';
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
  }

  static async queryById(_id, context) {
    const query = { _id };
    const task = await Task.findOne(query);
    if (!task) throw new NotFoundError('Task not found');

    if (task.projectId !== context.user['curr_project']) {
        throw new NotFoundError('Task does not belong to current project');
    }

    return task;
  }

  static async create(input) {
    const task = new Task(input);
    await task.save();
    return task;
  }
}

export default class AuthedTaskModel {
  constructor(user) {
    if (!user) throw new AuthenticationError('Authentication failed');
    this.user = user;
  }

  async queryById(input, context) {
    if (!hasRole(this.user, READ_TASKS_ROLES)) throw new ForbiddenError();

    return await TaskModel.queryById(input, context);
  }

  async queryByFilter(input, context) {
    if (!hasRole(this.user, READ_TASKS_ROLES)) throw new ForbiddenError();

    return await TaskModel.queryByFilter(input, context);
  }
}
