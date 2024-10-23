import { type User } from '../api/auth/authorization.js';
import { ImageModel } from '../api/db/models/Image.js';
import { TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';

export async function DeleteImagesByFilter(task: TaskInput<gql.DeleteImagesByFilterTaskInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  let images = await ImageModel.queryByFilter(
    { filters: task.config.filters, limit: 100 },
    context,
  );
  while (images.results.length > 0) {
    await ImageModel.deleteImages({ imageIds: images.results.map((image) => image._id) }, context);
    if (images.hasNext) {
      images = await ImageModel.queryByFilter(
        { filters: task.config.filters, limit: 100, next: images.next },
        context,
      );
    } else {
      break;
    }
  }

  return { isOk: true };
}

export async function DeleteImages(task: TaskInput<gql.DeleteImagesInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  while (task.config.imageIds?.length && task.config.imageIds.length > 0) {
    const batch = task.config.imageIds?.splice(0, 100);
    await ImageModel.deleteImages({ imageIds: batch }, context);
  }
  return { isOk: true };
}
