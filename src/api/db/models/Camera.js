const { ApolloError } = require('apollo-server-errors');
const { image } = require('../../resolvers/Query');
const Project = require('../schemas/Project');
const Camera = require('../schemas/Camera');
const Image = require('../schemas/Image');
const { hasRole, mapImageToDeployment, retryWrapper } = require('./utils');
const retry = retryWrapper;


const generateCameraModel = ({ user } = {}) => ({

  getCameras: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    console.log(`CameraModel.getCameras() - query: ${query}`);
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
        const existingCam = await this.getCameras([cameraId]);
        if (existingCam.length === 0) {
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
          return { ok: true, camera, project };
        }

        const cam = existingCam[0];
        console.log(`CameraModel.registerCamera() - Found camera: `, cam);
        const activeReg = cam.projRegistrations.find((proj) => proj.active);
        if (activeReg.project === 'default_project') {
          console.log(`CameraModel.registerCamera() - Camera exists and it's currently registered to default project, so reassigning to ${projectId} project...`);
          // if it exists & default proj is active (i.e., it's unregistered),
          // change to current project
          // NOTE: projReg might already exist for the current project, 
          // or we might have to create one
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
          return { ok: true, camera: cam, project };
        }
        else if (activeReg.project !== projectId) {
          console.log(`CameraModel.registerCamera() - camera exists, but it's registered to a different project, so rejecting registration`);
          // if it's mapped to another project that's the user's current one 
          // (i.e. user['curr_project'] reject registration
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

  // TODO AUTH - create unregisterCamera() handler

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
