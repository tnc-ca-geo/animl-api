import { type User } from '../api/auth/authorization.js';
import { ImageModel } from '../api/db/models/Image.js';
import Image from '../api/db/schemas/Image.js';
import Project from '../api/db/schemas/Project.js';
import { TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';
import { buildPipeline, getMultiTimezoneCameras } from '../api/db/models/utils.js';
import { TimestampOffsetValidationError } from '../api/errors.js';

/**
 * Validates that a set of images is eligible to receive a timestamp offset.
 * Currently this means that no images matching the input belong to cameras
 * with deployments in multiple timezones, as this would yield ambiguous
 * and potentially unexpected product behavior.
 *
 * Accepts either filters or imageIds to identify the images to validate.
 * Throws ForbiddenError if validation fails.
 */
export async function validateTimestampOffsetChangeset(
  projectId: string,
  filters?: gql.FiltersInput,
  imageIds?: string[],
): Promise<void> {
  const project = await Project.findById(projectId);
  if (!project) return;

  // We expect most requests to return here, since cameras with deployments in
  // multiple timezones is rare (read: doesn't exist in production as of 12/2025)
  const multiTimezoneCameras = getMultiTimezoneCameras(project.cameraConfigs);
  if (multiTimezoneCameras.size === 0) return;

  // Use a mongo aggregation to discover whether we have any images that could potentially
  // end up in a new deployment with a new timezone as a result of a timestamp offset
  let pipeline;
  if (imageIds) {
    pipeline = [
      { $match: { _id: { $in: imageIds }, projectId } },
      { $match: { cameraId: { $in: [...multiTimezoneCameras] } } },
      { $count: 'count' },
    ];
  } else if (filters) {
    // Get cameras from filters - either directly or by mapping deployments back to cameras
    const filteredCameras = new Set(filters.cameras ?? []);

    if (filters.deployments) {
      const deploymentSet = new Set(filters.deployments);
      for (const camConfig of project.cameraConfigs) {
        if (camConfig.deployments.some((dep) => deploymentSet.has(dep._id!.toString()))) {
          filteredCameras.add(camConfig._id);
        }
      }
    }

    // Intersect with multi-timezone cameras
    const camerasToCheck =
      filteredCameras.size > 0
        ? [...filteredCameras].filter((c) => multiTimezoneCameras.has(c))
        : [...multiTimezoneCameras];

    if (camerasToCheck.length === 0) return;

    pipeline = buildPipeline({ ...filters, cameras: camerasToCheck }, projectId);
    pipeline.push({ $count: 'count' });
  } else {
    return;
  }

  const result = await Image.aggregate(pipeline);
  const affectedCount = result[0]?.count ?? 0;

  if (affectedCount > 0) {
    throw new TimestampOffsetValidationError(
      'Requested offset impacts images from cameras with deployments in multiple timezones. This is not currently supported as it may produce unintended results. Please reach out to animl@tnc.org for guidance.',
    );
  }
}

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
   * Sets dateTimeAdjusted for a list of images by their IDs in batches.
   * * @param {Object} input
   * * @param {String[]} input.config.imageIds
   * * @param {number} input.config.offsetMs
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };

  await validateTimestampOffsetChangeset(task.projectId, undefined, task.config.imageIds);

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
    // count match as success, even if dateTimeAdjusted was already set
    failedCount += batch.length - (res.matchedCount || 0);
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
   * Sets dateTimeAdjusted for images that match the input filters in batches
   * * @param {Object} input
   * * @param {gql.FiltersInput} input.config.filters
   * * @param {number} input.config.offsetMs
   */
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };

  await validateTimestampOffsetChangeset(task.projectId, task.config.filters);

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
    // count match as success, even if dateTimeAdjusted was already set
    failedCount += batch.length - (res.matchedCount || 0);

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
