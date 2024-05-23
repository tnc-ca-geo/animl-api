import { User } from '../api/auth/authorization.js';
import {
  CreateDeploymentInput,
  DeleteDeploymentInput,
  ProjectModel,
  UpdateDeloymentInput,
} from '../api/db/models/Project.js';
import { TaskInput } from '../api/db/models/Task.js';
import { Context } from '../api/db/models/utils.js';

export async function CreateDeployment(task: TaskInput<CreateDeploymentInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.createDeployment(task.config, context as Context);
}

export async function UpdateDeployment(task: TaskInput<UpdateDeloymentInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.updateDeployment(task.config, context as Context);
}

export async function DeleteDeployment(task: TaskInput<DeleteDeploymentInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.deleteDeployment(task.config, context as Context);
}
