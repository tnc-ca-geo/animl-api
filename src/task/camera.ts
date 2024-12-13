import { type User } from '../api/auth/authorization.js';
import { CameraModel } from '../api/db/models/Camera.js';
import { type TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';
import { ProjectModel } from '../api/db/models/Project.js';
import { DeleteImagesByFilter } from './image.js';

export async function UpdateSerialNumber(task: TaskInput<gql.UpdateCameraSerialNumberInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await CameraModel.updateSerialNumber(task.config, context);
}

export async function DeleteCamera(task: TaskInput<gql.DeleteCameraInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  console.log('CameraModel.deleteCameraConfig - input: ', task.config);
  const errors = [];
  try {
    // Step 1: delete deployments from views
    await ProjectModel.removeCameraFromViews(
      {
        cameraId: task.config.cameraId,
      },
      context,
    );
    // Step 2: delete camera record from project
    await ProjectModel.deleteCameraConfig(
      {
        cameraId: task.config.cameraId,
      },
      context,
    );

    // Step3: delete images associated with this camera
    const deleteRes = await DeleteImagesByFilter({
      projectId: task.projectId,
      config: {
        filters: {
          cameras: [task.config.cameraId],
        },
      },
      type: 'DeleteImagesByFilter',
      user: task.user,
    });
    if (deleteRes.errors) {
      errors.push(...deleteRes.errors);
    }
    // Step 4: unregister camera
    if (
      (await CameraModel.getWirelessCameras({ _ids: [task.config.cameraId] }, context)).length > 0
    ) {
      await CameraModel.removeProjectRegistration({ cameraId: task.config.cameraId }, context);
    }
  } catch (err) {
    return { isOk: false, error: err };
  }
  return { isOk: true, errors: errors };
}
