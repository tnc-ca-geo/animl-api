import { User } from '../api/auth/authorization.js';
import { ProjectModel } from '../api/db/models/Project.js';
import { DeploymentSchema } from '../api/db/schemas/Project.js';
import { TaskInput } from '../api/db/models/Task.js';
import { Context } from '../api/db/models/utils.js';

export async function CreateDeployment(task: TaskInput<DeploymentSchema>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.createDeployment(task.config, context as Context);
}

export async function UpdateDeployment(task: TaskInput<DeploymentSchema>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.updateDeployment(task.config, context as Context);
}

export async function DeleteDeployment(task: TaskInput<DeploymentSchema>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ProjectModel.deleteDeployment(task.config, context as Context);
}
