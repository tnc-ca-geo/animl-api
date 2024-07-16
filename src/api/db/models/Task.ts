import { NotFoundError } from '../../errors.js';
import SQS from '@aws-sdk/client-sqs';
import MongoPaging, { AggregationOutput } from 'mongo-cursor-pagination';
import Task, { TaskSchema } from '../schemas/Task.js';
import { READ_TASKS_ROLES } from '../../auth/roles.js';
import { BaseAuthedModel, MethodParams, roleCheck } from './utils-model.js';
import { Context } from '../../handler.js';
import * as gql from '../../../@types/graphql.js';
import { HydratedDocument } from 'mongoose';

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
  static async queryByFilter(
    input: gql.QueryTasksInput,
    context: Context,
  ): Promise<AggregationOutput<TaskSchema>> {
    return await MongoPaging.aggregate(Task.collection, {
      aggregation: [
        { $match: { projectId: context.user['curr_project'] } },
        { $match: { user: context.user.sub } },
      ],
      limit: input.limit,
      paginatedField: input.paginatedField,
      sortAscending: input.sortAscending,
      next: input.next,
      previous: input.previous,
    });
  }

  static async queryById(_id: string, context: Context): Promise<HydratedDocument<TaskSchema>> {
    const query = { _id: { $eq: _id } };
    const task = await Task.findOne(query);
    if (!task) throw new NotFoundError('Task not found');

    if (task.projectId !== context.user['curr_project']) {
      throw new NotFoundError('Task does not belong to current project');
    }

    return task;
  }

  static async create(input: TaskInput, context: Context): Promise<HydratedDocument<TaskSchema>> {
    const task = new Task({
      user: input.user,
      projectId: input.projectId,
      type: input.type,
    });

    const sqs = new SQS.SQSClient({ region: process.env.AWS_DEFAULT_REGION });

    await task.save();

    await sqs.send(
      new SQS.SendMessageCommand({
        QueueUrl: context.config['/TASKS/TASK_QUEUE_URL'],
        MessageBody: JSON.stringify({
          config: input.config,
          ...task.toJSON(),
        }),
      }),
    );
    return task;
  }

  static async update(
    input: Partial<TaskSchema> & { _id: gql.Scalars['ID']['input'] },
    context: Context,
  ): Promise<HydratedDocument<TaskSchema>> {
    const task = await this.queryById(input._id, context);

    input.updated = new Date();

    Object.assign(task, input);
    await task.save();
    return task;
  }
}

export default class AuthedTaskModel extends BaseAuthedModel {
  @roleCheck(READ_TASKS_ROLES)
  queryById(...args: MethodParams<typeof TaskModel.queryById>) {
    return TaskModel.queryById(...args);
  }

  @roleCheck(READ_TASKS_ROLES)
  queryByFilter(...args: MethodParams<typeof TaskModel.queryByFilter>) {
    return TaskModel.queryByFilter(...args);
  }
}

export interface TaskInput extends Pick<TaskSchema, 'user' | 'projectId' | 'type'> {
  config: any;
}
