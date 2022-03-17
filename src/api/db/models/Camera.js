const { ApolloError } = require('apollo-server-errors');
const { image } = require('../../resolvers/Query');
const Project = require('../schemas/Project');
const Camera = require('../schemas/Camera');
const Image = require('../schemas/Image');
const { hasRole, mapImageToDeployment, retryWrapper } = require('./utils');
const retry = retryWrapper;


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
      return cameras;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // NEW
  // TODO: also return upated project
  get createCamera() {
    // if (!hasRole(user, ['animl_sci_project_owner', 'animl_superuser'])) {
    //   return null;
    // }
    return async ({ projectId, cameraId, make, model }, context) => {
      console.log(`CameraModel.createCamera() - creating camera`);
      projectId = projectId || 'default_project';
      try {
        // NEW - create "source" Camera record
        const newCamera = new Camera({
          _id: cameraId,
          make,
          projRegistrations: [{ project: projectId, projectId, active: true }],
          ...(model && { model }),
        });
        await newCamera.save();
        console.log(`CameraModel.createCamera() - newCamera: ${newCamera}`);

        // NEW - create camera config entry in Project.cameras
        // should this be somewhere else? move up to mutation resolver level?
        const project = await context.models.Project.createCameraConfig(
          projectId,
          newCamera._id
        );

        return { camera: newCamera, project };
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },

  // NEW
  get registerCamera() {
    return async ({ cameraId, make }, context) => {
      // TODO AUTH - DOES superuser ever have to registerCameras?
      // if so, we can't just use user['curr_project']
      const projectId = user['curr_project'];
      console.log(`CameraModel.registerCamera() - projectId: ${projectId}`);
      console.log(`CameraModel.registerCamera() - cameraId: ${cameraId}`);
      console.log(`CameraModel.registerCamera() - make: ${make}`);

      try {
        const cam = await Camera.findOne({ _id: cameraId });
        console.log(`CameraModel.registerCamera() - Found camera: `, cam);
        if (!cam) {
          // if no camera found, create new source "Camera" record
          // and CameraConfig entry
          console.log(`CameraModel.registerCamera() - Couldn't find an existing camera, so creating new one and registering it to ${projectId} project...`);
          const { camera, project } = await retry(
            this.createCamera,
            { projectId, cameraId, make },
            context
          );
          console.log(`CameraModel.registerCamera() - New camera: `, camera);
          console.log(`CameraModel.registerCamera() - updated project: `, project);
          const cameras = await this.getCameras();
          return { ok: true, cameras, project };
        }

        const activeReg = cam.projRegistrations.find((proj) => proj.active);
        if (activeReg.project === 'default_project') {
          console.log(`CameraModel.registerCamera() - Camera exists and it's currently registered to default project, so reassigning to ${projectId} project...`);
          // if camera exists & is registered to default_project,
          // register to current project
          let foundProject = false;
          cam.projRegistrations = cam.projRegistrations.map((proj) => {
            if (proj.project === projectId) foundProject = true;
            return {
              project: proj.project,
              active: (proj.project === projectId),
            }
          });
          if (!foundProject) {
            cam.projRegistrations.push({ project: projectId, active: true });
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
        else if (activeReg.project !== projectId) {
          console.log(`CameraModel.registerCamera() - camera exists, but it's registered to a different project, so rejecting registration`);
          // if it's mapped to a different project than the user's current one, 
          // so reject registration.
          // TODO AUTH - or do we throw error here? 
          return {
            ok: false,
            rejectionInfo: {
              currProjReg: activeReg.project,
              msg: 'This camera is currently registered to a different project!'
            }
          };
        }
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },

  // NEW
  get unregisterCamera() {
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
          return reject({ msg: `Couldn't find camera record for camera ${cameraId}` });
        }

        const activeReg = cam.projRegistrations.find((proj) => proj.active);
        if (activeReg.project === 'default_project') {
          return reject({ msg: `You can't unregister cameras from the default project` });
        }
        else if (activeReg.project !== projectId) {
          return reject({ 
            msg: `This camera is not currently registered to ${projectId}`,
            currProjReg: activeReg.project,
          });
        }

        // if active registration === curr_project, reset to false,
        // and set default project registration to active
        activeReg.active = false;
        let defaultProjReg = cam.projRegistrations.find((proj) => (
          proj.project === 'default_project'
        ));
        if (defaultProjReg) {
          defaultProjReg.active = true
        }
        else {
          cam.projRegistrations.push({
            project: 'default_project',
            active: true
          });
        }
        await cam.save();

        // make sure there's a Project.cameras config record for this camera 
        // in the default_project and and create one if not
        const projects = await context.models.Project.getProjects(['default_project']);
        let defaultProj = projects[0];
        console.log(`CameraModel.unregisterCamera() - defaultProj: ${JSON.stringify(defaultProj)}`)
        const camConfig = defaultProj.cameras.find((cc) => cc._id === cameraId);
        if (!camConfig) {
          console.log(`CameraModel.unregisterCamera() - Couldn't find a camConfig on default project for camera ${cameraId}, so creating one`)
          defaultProj = await context.models.Project.createCameraConfig(
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

  // reMapImagesToDeps: async (camera) => {
  //   try {
  //     // build array of operations from camera.deployments:
  //     // for each deployment, build filter, update, then perform bulkWrite
  //     let operations = [];
  //     for (const [index, dep] of camera.deployments.entries()) {
  //       const createdStart = dep.startDate || null;
  //       const createdEnd = camera.deployments[index + 1] 
  //         ? camera.deployments[index + 1].startDate
  //         : null;

  //       let filter = { cameraSn: camera._id };
  //       if (createdStart || createdEnd) {
  //         filter.dateTimeOriginal = {
  //           ...(createdStart && { $gte: createdStart }),
  //           ...(createdEnd && { $lt: createdEnd }),
  //         }
  //       }
  //       const update = { deployment: dep._id }
  //       operations.push({ updateMany: { filter, update } });
  //     };

  //     await Image.bulkWrite(operations);

  //   } catch (err) {
  //     throw new ApolloError(err);
  //   }
  // },

  // get createDeployment() {
  //   return async (input, context) => {
  //     const { cameraId, deployment } = input;
  //     try {
  //       let camera = await this.getCameras([cameraId]);
  //       camera = camera[0];
  //       camera.deployments.push(deployment);
  //       await camera.save();
  //       await this.reMapImagesToDeps(camera);
  //       return camera;
  //     } catch (err) {
  //       throw new ApolloError(err);
  //     }
  //   }
  // },

  // get updateDeployment() {
  //   return async (input, context) => {
  //     const { cameraId, deploymentId, diffs } = input;
  //     try {
  //       let camera = await this.getCameras([cameraId]);
  //       camera = camera[0];
  //       const deployment = camera.deployments.find((dep) => (
  //         dep._id.toString() === deploymentId.toString()
  //       ));
  //       if (deployment.name !== 'default') {
  //         for (let [key, newVal] of Object.entries(diffs)) {
  //           deployment[key] = newVal;
  //         }
  //         await camera.save();
  //         if (Object.keys(diffs).includes('startDate')) {
  //           await this.reMapImagesToDeps(camera);
  //         }
  //       }
  //       return camera;
  //     } catch (err) {
  //       throw new ApolloError(err);
  //     }
  //   }
  // },

  // get deleteDeployment() {
  //   return async (input, context) => {
  //     const { cameraId, deploymentId } = input;
  //     try {
  //       let camera = await this.getCameras([cameraId]);
  //       camera = camera[0];
  //       const newDeps = camera.deployments.filter((dep) => (
  //         dep._id.toString() !== deploymentId.toString()
  //       ));
  //       camera.deployments = newDeps;
  //       await camera.save();
  //       await this.reMapImagesToDeps(camera);
  //       return camera
  //     } catch (err) {
  //       throw new ApolloError(err);
  //     }
  //   }
  // },

 });

 module.exports = generateCameraModel;

// TODO: pass user into model generators to perform authorization at the
// data fetching level. e.g.:
// export const generateCameraModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
