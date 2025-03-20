import { type User } from '../api/auth/authorization.js';
import { ProjectModel } from '../api/db/models/Project.js';
import { type TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';

export async function DeleteProjectLabel(task: TaskInput<gql.DeleteProjectLabelInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.deleteLabel(task.config, context);
}
