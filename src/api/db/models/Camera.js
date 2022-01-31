const { ApolloError } = require('apollo-server-errors');
const { image } = require('../../resolvers/Query');
const Camera = require('../schemas/Camera');
const Image = require('../schemas/Image');
const { hasRole, mapImageToDeployment } = require('./utils');

const generateCameraModel = ({ user } = {}) => ({

  getCameras: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const cameras = await Camera.find(query);
      return cameras;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  get createCamera() {
    if (!hasRole(user, ['animl_sci_project_owner', 'animl_superuser'])) {
      return null;
    }
    
    return async (md) => {
      try {
        console.log(`Creating new camera record for camera with md - ${md}`);
        const newCamera = new Camera({
          _id: md.serialNumber,
          make: md.make,
          deployments: [{
            name: 'default',
            description: 'This is the default deployment. It is not editable',
            editable: false,
          }],
          ...(md.model && { model: md.model }),
        });
        await newCamera.save();
        return newCamera;
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },

  reMapImagesToDeps: async (camera) => {
    try {
      // build array of operations from camera.deployments:
      // for each deployment, build filter, update, then perform bulkWrite
      let operations = [];
      for (const [index, dep] of camera.deployments.entries()) {
        const createdStart = dep.startDate || null;
        const createdEnd = camera.deployments[index + 1] 
          ? camera.deployments[index + 1].startDate
          : null;

        let filter = { cameraSn: camera._id };
        if (createdStart || createdEnd) {
          filter.dateTimeOriginal = {
            ...(createdStart && { $gte: createdStart }),
            ...(createdEnd && { $lt: createdEnd }),
          }
        }
        const update = { deployment: dep._id }
        operations.push({ updateMany: { filter, update } });
      };

      await Image.bulkWrite(operations);

    } catch (err) {
      throw new ApolloError(err);
    }
  },

  get createDeployment() {
    return async (input, context) => {
      const { cameraId, deployment } = input;
      try {
        let camera = await this.getCameras([cameraId]);
        camera = camera[0];
        camera.deployments.push(deployment);
        await camera.save();
        await this.reMapImagesToDeps(camera);
        return camera;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get updateDeployment() {
    return async (input, context) => {
      const { cameraId, deploymentId, diffs } = input;
      try {
        let camera = await this.getCameras([cameraId]);
        camera = camera[0];
        const deployment = camera.deployments.find((dep) => (
          dep._id.toString() === deploymentId.toString()
        ));
        if (deployment.name !== 'default') {
          for (let [key, newVal] of Object.entries(diffs)) {
            deployment[key] = newVal;
          }
          await camera.save();
          if (Object.keys(diffs).includes('startDate')) {
            await this.reMapImagesToDeps(camera);
          }
        }
        return camera;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get deleteDeployment() {
    return async (input, context) => {
      const { cameraId, deploymentId } = input;
      try {
        let camera = await this.getCameras([cameraId]);
        camera = camera[0];
        const newDeps = camera.deployments.filter((dep) => (
          dep._id.toString() !== deploymentId.toString()
        ));
        camera.deployments = newDeps;
        await camera.save();
        await this.reMapImagesToDeps(camera);
        return camera
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

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
