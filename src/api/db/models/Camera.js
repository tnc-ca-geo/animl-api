const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const Camera = require('../schemas/Camera');
const retry = require('async-retry');
const { WRITE_CAMERA_REGISTRATION_ROLES } = require('../../auth/roles');
const { hasRole } = require('./utils');


const generateCameraModel = ({ user } = {}) => ({

  getCameras: async (_ids) => {
    let query = _ids ? { _id: { $in: _ids } } : {};
    // if user has curr_project, limit returned cameras to those that 
    // have at one point been assoicted with curr_project
    const projectId = user['curr_project'];
    if (projectId) query['projRegistrations.project'] = projectId;
    console.log(`CameraModel.getCameras() - query: ${JSON.stringify(query)}`);
    try {
      const cameras = await Camera.find(query);
      console.log(`CameraModel.getCameras() - found cameras: ${JSON.stringify(cameras)}`);
      return cameras;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // TODO: also return updated project?
  // might be useful in Image.createImage()
  get createCamera() {
    return async (input, context) => {
      console.log(`CameraModel.createCamera() - creating camera`);
      const projectId = input.projectId || 'default_project';

      // create "source" Camera record
      const saveCamera = async (input) => {
        const { projectId, cameraId, make, model } = input;
        return await retry(async (bail, attempt) => {
          const newCamera = new Camera({
            _id: cameraId,
            make,
            projRegistrations: [{ project: projectId, active: true }],
            ...(model && { model }),
          });
          await newCamera.save();
          return newCamera;
        }, { retries: 2 });
      };

      try {
        // create "source" Camera record
        const camera = await saveCamera({...input, projectId });
        console.log(`CameraModel.createCamera() - camera: ${camera}`);
        // and CameraConfig record
        const project = await context.models.Project.createCameraConfig(
          projectId,
          camera._id
        );
        return { camera, project };

      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },

  get registerCamera() {
    if (!hasRole(user, WRITE_CAMERA_REGISTRATION_ROLES)) throw new ForbiddenError;
    return async ({ cameraId, make }, context) => {
      const projectId = user['curr_project'];
      console.log(`CameraModel.registerCamera() - projectId: ${projectId}`);
      console.log(`CameraModel.registerCamera() - cameraId: ${cameraId}`);
      console.log(`CameraModel.registerCamera() - make: ${make}`);

      try {
        const cam = await Camera.findOne({ _id: cameraId });
        console.log(`CameraModel.registerCamera() - Found camera: `, cam);

        // if no camera found, create new "source" Camera record & cameraConfig
        if (!cam) {
          console.log(`CameraModel.registerCamera() - Couldn't find an existing camera, so creating new one and registering it to ${projectId} project...`);
          const res = await this.createCamera(
            { projectId, cameraId, make }, 
            context
          );
          const cameras = await this.getCameras();
          return { ok: true, cameras, project: res.project };
        }

        // if camera exists & is registered to default_project, 
        // reassign it to user's current project, else reject registration
        const activeReg = cam.projRegistrations.find((proj) => proj.active);
        if (activeReg.project === 'default_project') {
          console.log(`CameraModel.registerCamera() - Camera exists and it's currently registered to default project, so reassigning to ${projectId} project...`);
          
          let foundProject = false;
          cam.projRegistrations = cam.projRegistrations.map((pr) => {
            if (pr.project === projectId) foundProject = true;
            return { project: pr.project, active: (pr.project === projectId) };
          });
          if (!foundProject) {
            cam.projRegistrations.push({
              project: projectId,
              active: true
            });
          }

          console.log(`CameraModel.registerCamera() - Camera before saving: `, cam);
          await cam.save();

          const project = await context.models.Project.createCameraConfig(
            projectId,
            cam._id
          );

          const cameras = await this.getCameras();
          return { ok: true, cameras, project };

        }
        else {
          console.log(`CameraModel.registerCamera() - camera exists, but it's registered to a different project, so rejecting registration`);
         
          const msg = activeReg.project === projectId
            ? `This camera is already registered to the ${projectId} project!`
            : `This camera is already registered to a different project!`;
          return {
            rejectionInfo: { currProjReg: activeReg.project, msg },
            ok: false,
          };

        }

      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },

  // NEW
  get unregisterCamera() {
    if (!hasRole(user, WRITE_CAMERA_REGISTRATION_ROLES)) throw new ForbiddenError;
    return async ({ cameraId }, context) => {
      // TODO AUTH - DOES superuser ever have to unregisterCameras?
      // if so, we can't just use user['curr_project']
      const projectId = user['curr_project'];
      console.log(`CameraModel.unregisterCamera() - projectId: ${projectId}`);
      console.log(`CameraModel.unregisterCamera() - cameraId: ${cameraId}`);

      const reject = ({ msg, currProjReg }) => {
        return {
          ok: false,
          rejectionInfo: { msg, currProjReg }
        };
      }

      try {

        const cameras = await Camera.find();
        const cam = cameras.find((c) => c._id === cameraId);
        if (!cam) {
          return reject({
             msg: `Couldn't find camera record for camera ${cameraId}` 
          });
        }

        const activeReg = cam.projRegistrations.find((proj) => proj.active);
        if (activeReg.project === 'default_project') {
          return reject({
            msg: `You can't unregister cameras from the default project`,
            currProjReg: activeReg.project,
          });
        }
        else if (activeReg.project !== projectId) {
          return reject({ 
            msg: `This camera is not currently registered to ${projectId}`,
            currProjReg: activeReg.project,
          });
        }

        // if active registration === curr_project, 
        // reset registration.active to false,
        // and set default_project registration to active
        activeReg.active = false;
        let defaultProjReg = cam.projRegistrations.find((proj) => (
          proj.project === 'default_project'
        ));
        if (defaultProjReg) defaultProjReg.active = true
        else {
          cam.projRegistrations.push({
            project: 'default_project',
            active: true
          });
        }
        await cam.save();

        // make sure there's a Project.cameras config record for this camera 
        // in the default_project and create one if not
        const [ defaultProj ] = await context.models.Project.getProjects(
          ['default_project']
        );

        console.log(`CameraModel.unregisterCamera() - found defaultProj: ${JSON.stringify(defaultProj)}`)
        const camConfig = defaultProj.cameras.find((cc) => cc._id === cameraId);
        if (!camConfig) {
          console.log(`CameraModel.unregisterCamera() - Couldn't find a camConfig on default project for camera ${cameraId}, so creating one`)
          await context.models.Project.createCameraConfig(
            'default_project',
            cameraId
          );
        }

        // TODO AUTH: also return updated default project? 
        return { ok: true, cameras };

      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },

 });

 module.exports = generateCameraModel;
