import { type User } from '../api/auth/authorization.js';
import { CameraModel } from '../api/db/models/Camera.js';
import { type TaskInput } from '../api/db/models/Task.js';
import type * as gql from '../@types/graphql.js';

export async function UpdateSerialNumber(task: TaskInput<gql.UpdateCameraSerialNumberInput>) {
  const context = { user: { is_superuser: true, curr_project: task.projectId } as User };
  return await CameraModel.updateSerialNumber(task.config, context);
}

export async function DeleteCamera(task: TaskInput<gql.DeleteCameraInput>) {
  console.log('DeleteCamera task:', task);
  return { isOk: true };
}
