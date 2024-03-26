import { ProjectModel } from '../api/db/models/Project.js';

export async function CreateDeployment(task) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  return await ProjectModel.createDeployment(task.config, context);
}

export async function UpdateDeployment(task) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  return await ProjectModel.updateDeployment(task.config, context);
}

export async function DeleteDeployment(task) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  return await ProjectModel.deleteDeployment(task.config, context);
}
