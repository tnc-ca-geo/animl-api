import { ProjectModel } from '../api/db/models/Project.js';
import { TaskInput } from './utils.js';

export async function CreateDeployment(task: TaskInput) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  return await ProjectModel.createDeployment(task.config, context);
}

export async function UpdateDeployment(task: TaskInput) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  return await ProjectModel.updateDeployment(task.config, context);
}

export async function DeleteDeployment(task: TaskInput) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  return await ProjectModel.deleteDeployment(task.config, context);
}
