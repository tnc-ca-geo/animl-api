import { ProjectModel } from '../api/db/models/Project.js';

export async function UpdateDeployment(task) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } };
  return await ProjectModel.updateDeployment(task.config, context);
}

