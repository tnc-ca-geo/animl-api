import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { CameraRegistrationError } from '../../errors.js';
import WirelessCamera from '../schemas/WirelessCamera.js';
import retry from 'async-retry';
import { WRITE_CAMERA_REGISTRATION_ROLES } from '../../auth/roles.js';
import { hasRole, idMatch } from './utils.js';

export class CameraModelView {
  static async getWirelessCameras(_ids, user) {
    const query = _ids ? { _id: { $in: _ids } } : {};
    // if user has curr_project, limit returned cameras to those that
    // have at one point been assoicted with curr_project
    const projectId = user['curr_project'];
    if (projectId) query['projRegistrations.projectId'] = projectId;
    try {
      const wirelessCameras = await WirelessCamera.find(query);
      console.log('getWirelessCameras - found wirelessCameras: ', wirelessCameras);
      return wirelessCameras;
    } catch (err) {
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err); /* error is uncontrolled, so throw new ApolloError */
    }
  }

  static async createWirelessCamera(input, context) {
    const successfulOps = [];
    const projectId = input.projectId || 'default_project';

    const saveWirelessCamera = async (input) => {
      const { projectId, cameraId, make, model } = input;
      return await retry(async () => {
        const newCamera = new WirelessCamera({
          _id: cameraId,
          make,
          projRegistrations: [{ projectId, active: true }],
          ...(model && { model })
        });
        await newCamera.save();
        return newCamera;
      }, { retries: 2 });
    };

    try {
      // create Wireless Camera record
      const camera = await saveWirelessCamera({ ...input, projectId });
      successfulOps.push({ op: 'cam-saved', info: { cameraId: camera._id } });
      // and CameraConfig record to the Project
      const project = await context.models.Project.createCameraConfig( projectId, camera._id);
      return { camera, project };

    } catch (err) {

      // reverse successful operations
      for (const op of successfulOps) {
        if (op.op === 'cam-saved') {
          await WirelessCamera.findOneAndDelete({ _id: op.info.cameraId });
        }
      }

      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async registerCamera(user, input, context) {
    const successfulOps = [];
    const projectId = user['curr_project'];

    try {
      const cam = await WirelessCamera.findOne({ _id: input.cameraId });

      // if no camera found, create new Wireless Camera record & cameraConfig
      if (!cam) {
        const { project } = await this.createWirelessCamera({
          projectId,
          cameraId: input.cameraId,
          make: input.make
        }, context);
        const wirelessCameras = await this.getWirelessCameras();
        return { wirelessCameras, project };
      }

      // else if camera exists & is registered to default_project,
      // reassign it to user's current project, else reject registration
      const activeReg = cam.projRegistrations.find((pr) => pr.active);
      if (activeReg.projectId === 'default_project') {

        let foundProject = false;
        cam.projRegistrations.forEach((pr) => {
          if (pr.projectId === projectId) foundProject = true;
          pr.active = (pr.projectId === projectId);
        });
        if (!foundProject) {
          cam.projRegistrations.push({ projectId, active: true });
        }

        await cam.save();
        successfulOps.push({ op: 'cam-registered', info: { cameraId: input.cameraId } });
        const wirelessCameras = await this.getWirelessCameras();
        const project = await context.models.Project.createCameraConfig(
          projectId,
          cam._id
        );

        return { wirelessCameras, project };

      }
      else {
        const msg = activeReg.projectId === projectId
          ? `This camera is already registered to the ${projectId} project!`
          : 'This camera is registered to a different project!';
        throw new CameraRegistrationError(msg, {
          currProjReg: activeReg.projectId
        });
      }

    } catch (err) {
      // reverse successful operations
      for (const op of successfulOps) {
        if (op.op === 'cam-registered') {
          await this.unregisterCamera(
            { cameraId: op.info.cameraId },
            context
          );
        }
      }

      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }
}

const generateCameraModel = ({ user } = {}) => ({
  get getWirelessCameras() {
    return async (input) => {
      return await CameraModelView.getWirelessCameras(input, user);
    };
  },
  createWirelessCamera: CameraModelView.createWirelesscamera,

  get registerCamera() {
    if (!hasRole(user, WRITE_CAMERA_REGISTRATION_ROLES)) throw new ForbiddenError;

    return async (input, context) => {
      return await CameraModelView.registerCamera(input, context, user);
    };
  },

  get unregisterCamera() {
    if (!hasRole(user, WRITE_CAMERA_REGISTRATION_ROLES)) {
      throw new ForbiddenError;
    }
    return async ({ cameraId }, context) => {
      const successfulOps = [];
      const projectId = user['curr_project'];

      try {

        const wirelessCameras = await WirelessCamera.find();
        const cam = wirelessCameras.find((c) => idMatch(c._id, cameraId));

        if (!cam) {
          const msg = `Couldn't find camera record for camera ${cameraId}`;
          throw new CameraRegistrationError(msg);
        }
        const activeReg = cam.projRegistrations.find((pr) => pr.active);
        if (activeReg.projectId === 'default_project') {
          const msg = 'You can\'t unregister cameras from the default project';
          throw new CameraRegistrationError(msg);
        }
        else if (activeReg.projectId !== projectId) {
          const msg = `This camera is not currently registered to ${projectId}`;
          throw new CameraRegistrationError(msg);
        }

        // if active registration === curr_project,
        // reset registration.active to false,
        // and set default_project registration to active
        activeReg.active = false;
        const defaultProjReg = cam.projRegistrations.find((pr) => (
          pr.projectId === 'default_project'
        ));
        if (defaultProjReg) defaultProjReg.active = true;
        else {
          cam.projRegistrations.push({
            projectId: 'default_project',
            active: true
          });
        }
        await cam.save();
        successfulOps.push({ op: 'cam-unregistered', info: { cameraId } });

        // make sure there's a Project.cameraConfig record for this camera
        // in the default_project and create one if not
        let [defaultProj] = await context.models.Project.getProjects(
          ['default_project']
        );

        let addedNewCamConfig = false;
        const camConfig = defaultProj.cameraConfigs.find((cc) => (
          idMatch(cc._id, cameraId)
        ));
        if (!camConfig) {
          defaultProj = await context.models.Project.createCameraConfig(
            'default_project',
            cameraId
          );
          addedNewCamConfig = true;
        }

        return { wirelessCameras, ...(addedNewCamConfig && { project: defaultProj }) };

      } catch (err) {
        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-unregistered') {
            await this.registerCamera({ cameraId: op.info.cameraId }, context);
          }
        }
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  }

});

export default generateCameraModel;
