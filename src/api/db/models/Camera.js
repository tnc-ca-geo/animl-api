const { ApolloError } = require('apollo-server-errors');
const Camera = require('../schemas/Camera');
const { hasRole } = require('./utils');

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
  }
  // TODO: add updateImgsDeploymentIds(i)
  //    get all images that belong to camera
  //    iterate throught them, mapImageToDeployment, if different update image 

  // TODO: add CUD resolvers for deployments
  // createDeployment(input: {cameraId, deployment})
  //    will have to updateImgsDeploymentIds
  // updateDeployment(input: {cameraId, deploymentId, diffs})
  //    if startDate changed, will have to updateImgsDeploymentIds
  // deleteDeployment(input: {cameraId, deploymentId, diffs})
  //    will have to updateImgsDeploymentIds


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
