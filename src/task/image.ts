import { type User } from '../api/auth/authorization.js';
import { ImageModel } from '../api/db/models/Image.js';
import { TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';

export async function DeleteImages(task: TaskInput<gql.DeleteImagesInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await ImageModel.deleteImages(task.config, context);
}
