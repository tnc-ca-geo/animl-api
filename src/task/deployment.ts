import { type User } from '../api/auth/authorization.js';
import { ProjectModel } from '../api/db/models/Project.js';
import { type TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';

export async function CreateDeployment(task: TaskInput<gql.CreateDeploymentInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.createDeployment(task.config, context);
}

export async function UpdateDeployment(task: TaskInput<gql.UpdateDeploymentInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.updateDeployment(task.config, context);
}

export async function DeleteDeployment(task: TaskInput<gql.DeleteDeploymentInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.deleteDeployment(task.config, context);
}
