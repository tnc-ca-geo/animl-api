import { type User } from '../api/auth/authorization.js';
import { ImageModel } from '../api/db/models/Image.js';
import Image from '../api/db/schemas/Image.js';
import { TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';

export async function DeleteImagesByFilter(
  task: TaskInput<gql.DeleteImagesByFilterTaskInput>,
): Promise<{ filters: gql.FiltersInput; errors: any[] }> {
  /**
   * Deletes images that match the inputted filters in batches of 300.
   * This is used by the frontend to delete all images currently shown.
   * * @param {Object} input
   * * @param {gql.FiltersInput} input.config.filters
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  let images = await ImageModel.queryByFilter(
    { filters: task.config.filters, limit: ImageModel.DELETE_IMAGES_BATCH_SIZE },
    context,
  );
  const errors = [];

  while (images.results.length > 0) {
    const batch = images.results.map((image) => image._id);
    const res = await ImageModel.deleteImages({ imageIds: batch }, context);
    if (res.errors) {
      errors.push(...res.errors);
    }
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

  return { filters: task.config.filters, errors: errors };
}

export async function DeleteImages(
  task: TaskInput<gql.DeleteImagesInput>,
): Promise<{ imageIds: String[]; errors: any[] }> {
  /**
   * Deletes a list of images by their IDs in batches of 300.
   * This is used by the frontend when the user is selecting more than 300 images to delete to delete at once.
   * * @param {Object} input
   * * @param {String[]} input.config.imageIds
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  const imagesToDelete = task.config.imageIds?.slice() ?? [];
  const errors = [];
  while (imagesToDelete.length > 0) {
    const batch = imagesToDelete.splice(0, ImageModel.DELETE_IMAGES_BATCH_SIZE);
    const res = await ImageModel.deleteImages({ imageIds: batch }, context);
    if (res.errors) {
      errors.push(...res.errors);
    }
  }
  return { imageIds: task.config.imageIds as String[], errors: errors };
}

export async function SetTimestampOffsetBatch(
  task: TaskInput<gql.SetTimestampOffsetBatchTaskInput>,
): Promise<{ imageIds: String[]; modifiedCount: number; errors: any[] }> {
  /**
   * Sets dateTimeOffsetMs for a list of images by their IDs in batches.
   * * @param {Object} input
   * * @param {String[]} input.config.imageIds
   * * @param {number} input.config.offsetMs
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  const imagesToUpdate = task.config.imageIds?.slice() ?? [];
  let totalModified = 0;
  let failedCount = 0;
  const errors = [];
  const BATCH_SIZE = 500;

  while (imagesToUpdate.length > 0) {
    const batch = imagesToUpdate.splice(0, BATCH_SIZE);
    const res = await ImageModel.setTimestampOffsetBatch(
      { imageIds: batch, offsetMs: task.config.offsetMs },
      context,
    );

    totalModified += res.modifiedCount;
    failedCount += batch.length - res.modifiedCount;
  }

  if (failedCount > 0) {
    errors.push(`Failed to update ${failedCount} images`);
  }

  return { imageIds: task.config.imageIds as String[], modifiedCount: totalModified, errors: errors };
}

export async function SetTimestampOffsetByFilter(
  task: TaskInput<gql.SetTimestampOffsetByFilterTaskInput>,
): Promise<{ filters: gql.FiltersInput; modifiedCount: number; errors: any[] }> {
  /**
   * Sets dateTimeOffsetMs for images that match the input filters in batches
   * * @param {Object} input
   * * @param {gql.FiltersInput} input.config.filters
   * * @param {number} input.config.offsetMs
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  const queryPageSize = 500;
  let images = await ImageModel.queryByFilter(
    { filters: task.config.filters, limit: queryPageSize },
    context,
  );

  let totalModified = 0;
  let failedCount = 0;
  const errors = [];

  while (images.results.length > 0) {
    const batch = images.results.map((image) => String(image._id));
    const res = await ImageModel.setTimestampOffsetBatch(
      { imageIds: batch, offsetMs: task.config.offsetMs },
      context,
    );

    totalModified += res.modifiedCount;
    failedCount += batch.length - res.modifiedCount;

    if (images.hasNext) {
      images = await ImageModel.queryByFilter(
        {
          filters: task.config.filters,
          limit: queryPageSize,
          next: images.next,
        },
        context,
      );
    } else {
      break;
    }
  }

  if (failedCount > 0) {
    errors.push(`Failed to update ${failedCount} images`);
  }
  return { filters: task.config.filters, modifiedCount: totalModified, errors: errors };
}
