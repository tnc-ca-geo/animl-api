import { type User } from '../api/auth/authorization.js';
import { ImageModel } from '../api/db/models/Image.js';
import { TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';

export async function DeleteImagesByFilter(task: TaskInput<gql.DeleteImagesByFilterTaskInput>) {
  /**
   * Deletes images that match the inputted filters in batches of 100.
   * This is used by the frontend to delete all images currently shown.
   * * @param {Object} input
   * * @param {gql.FiltersInput} input.config.filters
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  let images = await ImageModel.queryByFilter(
    { filters: task.config.filters, limit: ImageModel.DELETE_IMAGES_BATCH_SIZE },
    context,
  );
  while (images.results.length > 0) {
    const batch = images.results.map((image) => image._id);
    await ImageModel.deleteImages({ imageIds: batch }, context);
    if (images.hasNext) {
      images = await ImageModel.queryByFilter(
        {
          filters: task.config.filters,
          limit: ImageModel.DELETE_IMAGES_BATCH_SIZE,
          next: images.next,
        },
        context,
      );
    } else {
      break;
    }
  }

  return { filters: task.config.filters };
}

export async function DeleteImages(task: TaskInput<gql.DeleteImagesInput>) {
  /**
   * Deletes a list of images by their IDs in batches of 100.
   * This is used by the frontend when the user is selecting more than 100 images to delete to delete at once.
   * * @param {Object} input
   * * @param {String[]} input.config.imageIds
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  const imagesToDelete = task.config.imageIds?.slice() ?? [];
  while (imagesToDelete.length > 0) {
    const batch = imagesToDelete.splice(0, ImageModel.DELETE_IMAGES_BATCH_SIZE);
    await ImageModel.deleteImages({ imageIds: batch }, context);
  }
  return { imageIds: task.config.imageIds };
}
