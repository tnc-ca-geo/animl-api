import { type User } from '../api/auth/authorization.js';
import { CameraModel } from '../api/db/models/Camera.js';
import { type TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';
import { ProjectModel } from '../api/db/models/Project.js';
import { DeleteImagesByFilter } from './image.js';
import { DeleteCameraError } from '../api/errors.js';

export async function UpdateSerialNumber(
  task: TaskInput<gql.UpdateCameraSerialNumberInput>,
): Promise<gql.StandardPayload> {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await CameraModel.updateSerialNumber(task.config, context);
}

export async function DeleteCamera(
  task: TaskInput<gql.DeleteCameraInput>,
): Promise<{ isOk: boolean; errors: any[] }> {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  console.log('CameraModel.deleteCameraConfig - input: ', task.config);
  const { cameraId } = task.config;
  const errors = [];

  // Prevent deleting wireless cameras from default_project
  const wirelessCam = await CameraModel.getWirelessCameras({ _ids: [cameraId] }, context);
  const isWirelessCam = wirelessCam.length > 0;
  if (isWirelessCam && task.projectId === 'default_project') {
    throw new DeleteCameraError('You cannot delete wireless cameras from the Default Project');
  }

  // Step 1: delete deployments from views
  await ProjectModel.removeCameraFromViews({ cameraId }, context);

  // Step 2: delete camera record from project
  await ProjectModel.deleteCameraConfig({ cameraId }, context);

  // Step 3: delete images associated with this camera
  const deleteRes = await DeleteImagesByFilter({
    projectId: task.projectId,
    config: { filters: { cameras: [cameraId] } },
    type: 'DeleteImagesByFilter',
    user: task.user,
  });

  if (deleteRes.errors) {
    errors.push(...deleteRes.errors);
  }

  // Step 4: if wireless camera, unregister camera
  if (isWirelessCam) {
    await CameraModel.removeProjectRegistration({ cameraId }, context);
  }

  // Note: `errors` is for any errors that occurred during the delete images step
  // the task will be marked as complete and the errors are not displayed to the user
  return { isOk: true, errors: errors };
}
