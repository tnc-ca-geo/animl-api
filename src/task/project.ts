import { type User } from '../api/auth/authorization.js';
import { ProjectModel } from '../api/db/models/Project.js';
import { type TaskInput } from '../api/db/models/Task.js';
import { type Config } from '../config/config.js';
import { Context } from '../api/handler.js';
import type * as gql from '../@types/graphql.js';

export async function DeleteProjectLabel(
  task: TaskInput<gql.DeleteProjectLabelInput>,
  config: Config,
) {
  const context = {
    user: { is_superuser: true, curr_project: task.projectId },
    config,
  } as Pick<Context, 'user' | 'config'>;
  return await ProjectModel.deleteLabel(task.config, context);
}
