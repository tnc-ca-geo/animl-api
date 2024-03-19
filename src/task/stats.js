import { ImageModel } from '../api/db/models/Image.js';

export default async function(task) {
  return await ImageModel.getStats(task.config, { user: { is_superuser: true, curr_project: task.projectId } });
}
