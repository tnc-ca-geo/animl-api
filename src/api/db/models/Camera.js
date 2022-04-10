const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { CameraRegistrationError } = require('../../errors');
const { GraphQLError } = require('graphql/error/GraphQLError');
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
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err); /* error is uncontrolled, so throw new ApolloError */
    }
  },

  get createCamera() {
    return async (input, context) => {
      console.log(`CameraModel.createCamera() - creating camera`);
      const successfulOps = [];
      const projectId = input.projectId || 'default_project';

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
        successfulOps.push({ op: 'cam-saved', info: { cameraId: camera._id} });
        // and CameraConfig record
        const project = await context.models.Project.createCameraConfig(
          projectId,
          camera._id
        );
        return { camera, project };

      } catch (err) {

        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-saved') {
            console.log(`CameraModel.createCamera() - reversing camera-saved operation`);
            await Camera.findOneAndDelete({ _id: op.info.cameraId });
          }
        }

        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get registerCamera() {
    if (!hasRole(user, WRITE_CAMERA_REGISTRATION_ROLES)) {
      throw new ForbiddenError;
    }
    return async ({ cameraId, make }, context) => {
      const successfulOps = [];
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
          return { cameras, project: res.project };
        }

        // else if camera exists & is registered to default_project, 
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
            cam.projRegistrations.push({ project: projectId, active: true });
          }

          console.log(`CameraModel.registerCamera() - Camera before saving: `, cam);
          await cam.save();
          successfulOps.push({ op: 'cam-registered', info: { cameraId }});
          const cameras = await this.getCameras();
          const project = await context.models.Project.createCameraConfig(
            projectId,
            cam._id
          );

          return { cameras, project };

        }
        else {
          console.log(`CameraModel.registerCamera() - camera exists, but it's registered to a different project, so rejecting registration`);
          const msg = activeReg.project === projectId
            ? `This camera is already registered to the ${projectId} project!`
            : `This camera is registered to a different project!`;
          throw new CameraRegistrationError(msg, {
            currProjReg: activeReg.project 
          });
        }

      } catch (err) {
        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-registered') {
            console.log(`CameraModel.registerCamera() - reversing camera registration operation`);
            await this.unregisterCamera({ cameraId: op.info.cameraId }, context);
          }
        }

        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get unregisterCamera() {
    if (!hasRole(user, WRITE_CAMERA_REGISTRATION_ROLES)) {
      throw new ForbiddenError;
    }
    return async ({ cameraId }, context) => {
      const successfulOps = [];
      // doneOps, execdOps, cmpltdOps, 
      const projectId = user['curr_project'];
      console.log(`CameraModel.unregisterCamera() - projectId: ${projectId}`);
      console.log(`CameraModel.unregisterCamera() - cameraId: ${cameraId}`);

      try {

        const cameras = await Camera.find();
        const cam = cameras.find((c) => c._id === cameraId);
        if (!cam) {
          const msg = `Couldn't find camera record for camera ${cameraId}`;
          throw new CameraRegistrationError(msg);
        }
        const activeReg = cam.projRegistrations.find((proj) => proj.active);
        if (activeReg.project === 'default_project') {
          const msg = `You can't unregister cameras from the default project`;
          throw new CameraRegistrationError(msg);
        }
        else if (activeReg.project !== projectId) {
          const msg = `This camera is not currently registered to ${projectId}`;
          throw new CameraRegistrationError(msg);
        }

        // if active registration === curr_project, 
        // reset registration.active to false,
        // and set default_project registration to active
        activeReg.active = false;
        let defaultProjReg = cam.projRegistrations.find((proj) => (
          proj.project === 'default_project'
        ));
        if (defaultProjReg) defaultProjReg.active = true;
        else {
          cam.projRegistrations.push({
            project: 'default_project',
            active: true
          });
        }
        await cam.save();
        successfulOps.push({ op: 'cam-unregistered', info: { cameraId } });

        // make sure there's a Project.cameras config record for this camera 
        // in the default_project and create one if not
        let [defaultProj] = await context.models.Project.getProjects(
          ['default_project']
        );

        console.log(`CameraModel.unregisterCamera() - found defaultProj: ${JSON.stringify(defaultProj)}`);
        let addedNewCamConfig = false;
        const camConfig = defaultProj.cameras.find((cc) => cc._id === cameraId);
        if (!camConfig) {
          console.log(`CameraModel.unregisterCamera() - Couldn't find a camConfig on default project for camera ${cameraId}, so creating one`)
          defaultProj = await context.models.Project.createCameraConfig(
            'default_project',
            cameraId
          );
          addedNewCamConfig = true;
        }

        return { cameras, ...(addedNewCamConfig && { project: defaultProj }) };

      } catch (err) {
        // reverse successful operations
        for (const op of successfulOps) {
          if (op.op === 'cam-unregistered') {
            console.log(`CameraModel.unregisterCamera() - reversing camera unregistration operation`);
            await this.registerCamera({ cameraId: op.info.cameraId }, context);
          }
        }
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

 });

 module.exports = generateCameraModel;
