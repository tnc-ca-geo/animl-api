const { ApolloError } = require('apollo-server-errors');
const { image } = require('../../resolvers/Query');
const Project = require('../schemas/Project');
const Camera = require('../schemas/Camera');
const Image = require('../schemas/Image');
const { hasRole, mapImageToDeployment } = require('./utils');

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
  get createCamera() {
    // if (!hasRole(user, ['animl_sci_project_owner', 'animl_superuser'])) {
    //   return null;
    // }
    return async ({ project, cameraSn, make, model }, context) => {
      project = project || 'default_project';
      try {
        // NEW - create "source" Camera record
        const newCamera = new Camera({
          _id: cameraSn,
          make,
          projRegistrations: [{ project, active: true }],
          ...(model && { model }),
        });
        console.log(`CameraModel.createCamera() - newCamera: ${newCamera}`);
        await newCamera.save();

        // NEW - create camera config entry in Project.cameras
        // should this be somewhere else? move up to mutation resolver level?
        await context.models.Project.createCameraConfig(project, newCamera._id);

        return newCamera;
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },

  // NEW
  get registerCamera() {
    return async ({ cameraSn, make }, context) => {
      // TODO AUTH - DOES superuser ever have to registerCameras?
      // if so, we can't just use user['curr_project']
      const project = user['curr_project'];
      console.log(`CameraModel.registerCamera() - project: ${project}`);
      console.log(`CameraModel.registerCamera() - cameraSn: ${cameraSn}`);
      console.log(`CameraModel.registerCamera() - make: ${make}`);

      try {
        const existingCam = await this.getCameras([cameraSn]);
        if (existingCam.length === 0) {
          // if no camera found, create new source "Camera" record
          // and CameraConfig entry
          console.log(`Couldn't find an existing camera, so creating new one...`);
          const newCam = await retry(
            this.createCamera,
            { project, cameraSn, make },
            context
          );
          return { ok: true };  // TODO AUTH - maybe better return val here?
        }

        const cam = existingCam[0];
        const activeReg = cam.projRegistrations.find((proj) => proj.active);
        if (activeReg.project === 'default_project') {
          // if it exists & default proj is active (i.e., it's unregistered),
          // change to current project
          // NOTE: projReg might already exist for the current project, 
          // or we might have to create one
          let foundProject = false;
          cam.projectRegistrations = cam.projectRegistrations.map((proj) => {
            if (proj.project === project) foundProject = true;
            return {
              project: proj.project,
              active: (proj.project === project),
            }
          });
          if (!foundProject) {
            cam.projectRegistrations.push({ project, active: true });
          }
          await cam.save();
          return { ok: true };
        }
        else if (activeReg.project !== project) {
          // if it's mapped to another project that's the user's current one 
          // (i.e. user['curr_project'] reject registration
          // TODO AUTH - or do we throw error here? 
          return {
            ok: false,
            currProjReg: activeReg.project,
            msg: 'This camera is currently registered to a different project!'
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
