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

  get createCamera() {  // use object getter so we can reference this.getCameras
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

  // TODO: add remapImagesToDeployments(i)
  //    get all images that belong to camera
  //    iterate throught them, mapImageToDeployment, if different update image 

  reMapImagesToDeps: async (camera) => {
    try {
      const images = Image.find({cameraSn: camera._id});
      for (const img of images) {
        const newDep = mapImageToDeployment(img, camera);
        if (img.deployment !== newDep) {
          img.deployment = newDep
          await img.save();
        }
      }
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  get createDeployment() {
    return async (input, context) => {
      console.log('createDeployment() - creating deployment with input: ', input);
      const { cameraId, deployment } = input;
      try {
        const camera = await this.getCameras([cameraId]);
        camera.deployments.push(deployment);
        await camera.save();
        await reMapImagesToDeps(camera);
        return camera;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get updateDeployment() {
    return async (input, context) => {
      console.log('updateDeployment() - updating deployment with input: ', input);
      const { cameraId, deploymentId, diffs } = input;
      try {
        const camera = await this.getCameras([cameraId]);
        console.log('updateDeployment() - found the camera: ', camera);
        const deployment = camera.deployments.find((dep) => (
          dep._id.toString() === deploymentId.toString()
        ));
        console.log('updateDeployment() - found the deployment: ', deployment);
        for (let [key, newVal] of Object.entries(diffs)) {
          deployment[key] = newVal;
        }
        await camera.save();
        if (Object.keys(diffs).includes('startDate')) {
          console.log('updateDeployment() - startDate was changed, so remapping images to deps');
          await reMapImagesToDeps(camera);
        }
        return camera;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get deleteDeployment() {
    return async (input, context) => {
      console.log('deleteDeployment() - deleting deployment with input: ', input);
      const { cameraId, deploymentId } = input;
      try {
        const camera = await this.getCameras([cameraId]);
        console.log('deleteDeployment() - found the camera: ', camera);
        const newDeps = camera.deployments.filter((dep) => (
          dep._id.toString() === deploymentId.toString()
        ));
        camera.deployments = newDeps;
        await camera.save();
        await reMapImagesToDeps(camera);
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
