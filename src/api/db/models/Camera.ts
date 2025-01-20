import mongoose, { HydratedDocument } from 'mongoose';
import GraphQLError, { InternalServerError, CameraRegistrationError } from '../../errors.js';
import WirelessCamera, { WirelessCameraSchema } from '../schemas/WirelessCamera.js';
import Images from '../schemas/Image.js';
import retry from 'async-retry';
import {
  WRITE_CAMERA_REGISTRATION_ROLES,
  WRITE_CAMERA_SERIAL_NUMBER_ROLES,
  WRITE_DELETE_CAMERA_ROLES,
} from '../../auth/roles.js';
import { ProjectModel } from './Project.js';
import { BaseAuthedModel, MethodParams, roleCheck, idMatch } from './utils.js';
import { Context } from '../../handler.js';
import type * as gql from '../../../@types/graphql.js';
import Project, { ProjectSchema } from '../schemas/Project.js';
import { TaskModel } from './Task.js';
import { TaskSchema } from '../schemas/Task.js';

const ObjectId = mongoose.Types.ObjectId;

export class CameraModel {
  static async getWirelessCameras(
    input: gql.QueryWirelessCamerasArgs['input'],
    context: Pick<Context, 'user'>,
  ): Promise<WirelessCameraSchema[]> {
    const query: Record<string, any> = input?._ids ? { _id: { $in: input._ids } } : {};
    // if user has curr_project, limit returned cameras to those that
    // have at one point been associated with curr_project
    const projectId = context.user['curr_project'];
    if (projectId) query['projRegistrations.projectId'] = projectId;
    try {
      const wirelessCameras = await WirelessCamera.find(query);
      console.log('getWirelessCameras - found wirelessCameras: ', JSON.stringify(wirelessCameras));
      return wirelessCameras;
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async createWirelessCamera(
    input: {
      projectId: string | null;
      cameraId: string;
      make?: string;
      model?: string;
    },
    context: Pick<Context, 'user'>,
  ): Promise<{ camera: WirelessCameraSchema; project: Maybe<ProjectSchema> }> {
    console.log('CameraModel.createWirelessCamera - input: ', input);
    const successfulOps: OperationMetadata[] = [];
    const projectId = input.projectId || 'default_project';

    try {
      // create Wireless Camera record
      const camera = await retry(
        async () => {
          const newCamera = new WirelessCamera({
            _id: input.cameraId,
            make: input.make,
            projRegistrations: [{ _id: new ObjectId(), projectId, active: true }],
            model: input.model,
          });
          await newCamera.save();
          return newCamera;
        },
        { retries: 2 },
      );
      successfulOps.push({ op: 'cam-saved', info: { cameraId: camera._id } });
      // and CameraConfig record to the Project
      const project = await ProjectModel.createCameraConfig(
        {
          projectId,
          cameraId: camera._id,
        },
        context,
      );
      return { camera, project };
    } catch (err) {
      // reverse successful operations
      for (const op of successfulOps) {
        if (op.op === 'cam-saved') {
          await WirelessCamera.findOneAndDelete({ _id: op.info.cameraId });
        }
      }

      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async registerCamera(
    input: { cameraId: string; make?: string },
    context: Pick<Context, 'user'>,
  ): Promise<{ wirelessCameras: WirelessCameraSchema[]; project: Maybe<ProjectSchema> }> {
    console.log('CameraModel.registerCamera - context: ', context);

    const successfulOps: OperationMetadata[] = [];
    const projectId = context.user['curr_project']!;
    const cameraId = input.cameraId.toString();

    try {
      const cam = await WirelessCamera.findOne({ _id: cameraId });

      // if no camera found, create new Wireless Camera record & cameraConfig
      if (!cam) {
        const { project } = await CameraModel.createWirelessCamera(
          {
            projectId,
            cameraId: cameraId,
            make: input.make,
          },
          context,
        );
        const wirelessCameras = await CameraModel.getWirelessCameras({}, context);
        return { wirelessCameras, project };
      }

      // else if camera exists & is registered to default_project,
      // reassign it to user's current project, else reject registration
      const activeReg = cam.projRegistrations.find((pr) => pr.active);
      if (activeReg?.projectId === 'default_project') {
        let foundProject = false;
        cam.projRegistrations.forEach((pr) => {
          if (pr.projectId === projectId) foundProject = true;
          pr.active = pr.projectId === projectId;
        });
        if (!foundProject) {
          cam.projRegistrations.push({ _id: new ObjectId(), projectId, active: true });
        }

        await cam.save();
        successfulOps.push({ op: 'cam-registered', info: { cameraId: input.cameraId } });
        const wirelessCameras = await CameraModel.getWirelessCameras({}, context);
        const project = await ProjectModel.createCameraConfig(
          {
            projectId,
            cameraId: cam._id,
          },
          context,
        );

        return { wirelessCameras, project };
      } else {
        const msg =
          activeReg?.projectId === projectId
            ? `This camera is already registered to the ${projectId} project!`
            : 'This camera is registered to a different project!';
        throw new CameraRegistrationError(msg, {
          currProjReg: activeReg?.projectId,
        });
      }
    } catch (err) {
      // reverse successful operations
      for (const op of successfulOps) {
        if (op.op === 'cam-registered') {
          await CameraModel.unregisterCamera({ cameraId: op.info.cameraId }, context);
        }
      }

      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async unregisterCamera(
    input: { cameraId: string },
    context: Pick<Context, 'user'>,
  ): Promise<{ wirelessCameras: WirelessCameraSchema[]; project?: ProjectSchema }> {
    const successfulOps: OperationMetadata[] = [];
    const projectId = context.user['curr_project'];

    try {
      const wirelessCameras = await WirelessCamera.find();
      const cam = wirelessCameras.find((c) => idMatch(c._id, input.cameraId));

      if (!cam) {
        const msg = `Couldn't find camera record for camera ${input.cameraId}`;
        throw new CameraRegistrationError(msg);
      }
      const activeReg = cam.projRegistrations.find((pr) => pr.active);
      if (activeReg?.projectId === 'default_project') {
        const msg = "You can't unregister cameras from the default project";
        throw new CameraRegistrationError(msg);
      } else if (activeReg?.projectId !== projectId) {
        const msg = `This camera is not currently registered to ${projectId}`;
        throw new CameraRegistrationError(msg);
      }

      // if active registration === curr_project,
      // reset registration.active to false,
      // and set default_project registration to active
      activeReg.active = false;
      const defaultProjReg = cam.projRegistrations.find((pr) => pr.projectId === 'default_project');
      if (defaultProjReg) defaultProjReg.active = true;
      else {
        cam.projRegistrations.push({
          _id: new ObjectId(),
          projectId: 'default_project',
          active: true,
        });
      }
      await cam.save();
      successfulOps.push({ op: 'cam-unregistered', info: { cameraId: input.cameraId } });

      // make sure there's a Project.cameraConfig record for this camera
      // in the default_project and create one if not
      let defaultProj = await Project.findOne({ _id: 'default_project' });
      if (!defaultProj) {
        throw new CameraRegistrationError('Could not find default project');
      }

      let addedNewCamConfig = false;
      const camConfig = defaultProj.cameraConfigs.find((cc) => idMatch(cc._id, input.cameraId));
      if (!camConfig) {
        defaultProj = (await ProjectModel.createCameraConfig(
          {
            projectId: 'default_project',
            cameraId: input.cameraId,
          },
          context,
        ))!;
        addedNewCamConfig = true;
      }

      return { wirelessCameras, ...(addedNewCamConfig && { project: defaultProj }) };
    } catch (err) {
      // reverse successful operations
      for (const op of successfulOps) {
        if (op.op === 'cam-unregistered') {
          await CameraModel.registerCamera({ cameraId: op.info.cameraId }, context);
        }
      }

      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  // NOTE: this function is called by the async task handler as part of the delete camera task
  static async removeProjectRegistration(
    input: { cameraId: string },
    context: Pick<Context, 'user'>,
  ): Promise<{ wirelessCameras: WirelessCameraSchema[]; project?: ProjectSchema }> {
    const projectId = context.user['curr_project'];

    try {
      const wirelessCameras = await WirelessCamera.find();
      const cam = wirelessCameras.find((c) => idMatch(c._id, input.cameraId));

      if (!cam) {
        const msg = `Couldn't find camera record for camera ${input.cameraId}`;
        throw new CameraRegistrationError(msg);
      }
      const activeReg = cam.projRegistrations.find((pr) => pr.active);

      // if active registration === curr_project,
      // set default_project registration to active
      if (activeReg?.projectId === projectId) {
        const defaultProjReg = cam.projRegistrations.find(
          (pr) => pr.projectId === 'default_project',
        );
        if (defaultProjReg) defaultProjReg.active = true;
        else {
          cam.projRegistrations.push({
            _id: new ObjectId(),
            projectId: 'default_project',
            active: true,
          });
        }
      }

      // remove registration for curr_project
      const currProjIndex = cam.projRegistrations.findIndex((pr) => pr.projectId === projectId);
      cam.projRegistrations.splice(currProjIndex, 1);
      await cam.save();

      // make sure there's a Project.cameraConfig record for this camera
      // in the default_project and create one if not
      let defaultProj = await Project.findOne({ _id: 'default_project' });
      if (!defaultProj) {
        throw new CameraRegistrationError('Could not find default project');
      }

      let addedNewCamConfig = false;
      const camConfig = defaultProj.cameraConfigs.find((cc) => idMatch(cc._id, input.cameraId));
      if (!camConfig) {
        defaultProj = (await ProjectModel.createCameraConfig(
          {
            projectId: 'default_project',
            cameraId: input.cameraId,
          },
          context,
        ))!;
        addedNewCamConfig = true;
      }

      return { wirelessCameras, ...(addedNewCamConfig && { project: defaultProj }) };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async updateSerialNumberTask(
    input: gql.UpdateCameraSerialNumberInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      return await TaskModel.create(
        {
          type: 'UpdateSerialNumber',
          projectId: context.user['curr_project'],
          user: context.user.sub,
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  // NOTE: this method is called by the async task handler
  static async updateSerialNumber(
    input: gql.UpdateCameraSerialNumberInput,
    context: Pick<Context, 'user'>,
  ): Promise<gql.StandardPayload> {
    const { cameraId, newId } = input;
    let successfulOps: OperationMetadata[] = [];
    console.log('CameraModel.updateSerialNumber - input: ', input);

    try {
      // check if it's a wireless camera
      const wirelessCamera = await WirelessCamera.findOne({ _id: cameraId });
      if (wirelessCamera) {
        throw new GraphQLError(`You can't update wireless cameras' serial numbers`);
      }

      // Step 1: update serial number on all images
      // TODO: do we want to wrap this all in a retry?
      const affectedImgIds = (await Images.find({ cameraId }, '_id')).map((img) =>
        img._id.toString(),
      );
      const res = await Images.updateMany({ cameraId }, { cameraId: newId });
      console.log('CameraModel.updateSerialNumber() Images.updateMany - res: ', res);
      if (res.matchedCount !== res.modifiedCount) {
        throw new GraphQLError('Not all images were updated successfully');
      }
      successfulOps.push({
        op: 'images-updated',
        info: { sourceCamId: input.cameraId, targetCamId: newId, affectedImgIds },
      });
      console.log('CameraModel.updateSerialNumber() - updated all images');

      // Step 2: check if we're merging a source camera into a target camera
      const project = await ProjectModel.queryById(context.user['curr_project']);
      const sourceCamConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, cameraId));
      const isMerge = project.cameraConfigs.some((cc) => idMatch(cc._id, newId));

      if (isMerge) {
        console.log(
          `CameraModel.updateSerialNumber() - merging cameras - source: ${cameraId}, target: ${newId}`,
        );
        const sourceDeployments =
          sourceCamConfig?.deployments.map((dep) => dep._id.toString()) || [];

        // Step 3: remove source cameraConfig from Project
        console.log('CameraModel.updateSerialNumber() - removing source cameraConfig');
        const ccIdx = project.cameraConfigs.findIndex((cc) => idMatch(cc._id, cameraId));
        project.cameraConfigs.splice(ccIdx, 1);

        // Step 4: re-map images to deployments in target cameraConfig
        console.log('CameraModel.updateSerialNumber() - re-mapping images to target cameraConfig');
        const targetCamConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, newId));
        if (!targetCamConfig) {
          throw new GraphQLError(`Could not find cameraConfig for camera ${newId}`);
        }
        await ProjectModel.reMapImagesToDeps({ projId: project._id, camConfig: targetCamConfig });
        successfulOps.push({
          op: 'images-remapped-to-target-deps',
          info: { sourceCamConfig },
        });

        // Step 5: remove source deployments from Views
        console.log('CameraModel.updateSerialNumber() - removing source deployments from Views');
        project.views.forEach((view) => {
          console.log('CameraModel.updateSerialNumber() - checking view: ', view.name);
          if (view.filters.deployments?.length) {
            console.log('CameraModel.updateSerialNumber() - view has deployments');
            view.filters.deployments = view.filters.deployments.filter(
              (depId) => !sourceDeployments.includes(depId),
            );
            console.log(
              'CameraModel.updateSerialNumber() - updated view.filters.deployments: ',
              view.filters.deployments,
            );
          }
        });
      } else {
        // Step 3: update Project's cameraConfig with new _id
        console.log(
          'CameraModel.updateSerialNumber() - NOT a merge. Just updating cameraConfig with new _id',
        );
        if (!sourceCamConfig) {
          throw new GraphQLError(`Could not find cameraConfig for camera ${cameraId}`);
        }
        sourceCamConfig._id = newId;
      }

      console.log('CameraModel.updateSerialNumber() - saving Project: ', project);
      await project.save();
      console.log('CameraModel.updateSerialNumber() - updated Project.cameraConfigs');

      return { isOk: true };
    } catch (err) {
      // reverse successful operations
      // NOTE: many of the mutations above involve updating the Project document,
      // which is the last operation and thus would be the last to fail,
      // so we can safely assume that if we're in this catch block,
      // the Project document has not been updated
      console.log('CameraModel.updateSerialNumber() - caught error: ', err);
      for (const op of successfulOps) {
        if (op.op === 'images-updated') {
          console.log('reversing images-updated operation');
          await Images.updateMany(
            { _id: { $in: op.info.affectedImgIds } },
            { cameraId: op.info.sourceCamId },
          );
        } else if (op.op === 'images-remapped-to-target-deps') {
          console.log('reversing images-remapped-to-target-deps operation');
          // re-map images back to source cameraConfig deployments
          // NOTE: the images that were already associated with the target cameraConfig
          // don't need to be re-mapped because their deploymentIds should not have changed
          await ProjectModel.reMapImagesToDeps({
            projId: context.user['curr_project'],
            camConfig: op.info.sourceCamConfig,
          });
        }
      }

      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  static async deleteCameraTask(
    input: gql.DeleteCameraInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<HydratedDocument<TaskSchema>> {
    try {
      console.log('CameraModel.deleteCameraTask - input: ', input);
      return await TaskModel.create(
        {
          type: 'DeleteCamera',
          projectId: context.user['curr_project'],
          user: context.user.sub,
          config: input,
        },
        context,
      );
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

export default class AuthedCameraModel extends BaseAuthedModel {
  async getWirelessCameras(...args: MethodParams<typeof CameraModel.getWirelessCameras>) {
    return await CameraModel.getWirelessCameras(...args);
  }

  async createWirelessCamera(...args: MethodParams<typeof CameraModel.createWirelessCamera>) {
    return await CameraModel.createWirelessCamera(...args);
  }

  @roleCheck(WRITE_CAMERA_REGISTRATION_ROLES)
  async registerCamera(...args: MethodParams<typeof CameraModel.registerCamera>) {
    return await CameraModel.registerCamera(...args);
  }

  @roleCheck(WRITE_CAMERA_REGISTRATION_ROLES)
  async unregisterCamera(...args: MethodParams<typeof CameraModel.unregisterCamera>) {
    return await CameraModel.unregisterCamera(...args);
  }

  @roleCheck(WRITE_CAMERA_SERIAL_NUMBER_ROLES)
  async updateSerialNumber(...args: MethodParams<typeof CameraModel.updateSerialNumberTask>) {
    return await CameraModel.updateSerialNumberTask(...args);
  }

  @roleCheck(WRITE_DELETE_CAMERA_ROLES)
  async deleteCameraConfig(...args: MethodParams<typeof CameraModel.deleteCameraTask>) {
    return await CameraModel.deleteCameraTask(...args);
  }
}

interface OperationMetadata {
  op: string;
  info: { [key: string]: any };
}
