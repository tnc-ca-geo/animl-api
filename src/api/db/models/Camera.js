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
    return async (image) => {
      const existingCam = await this.getCameras([ image.cameraSn ]);
      if (existingCam.length === 0) {
        try {
          console.log(`Creating new camera record for camera - ${image.cameraSn}`);
          const newCamera = new Camera({
            _id: image.cameraSn,
            make: image.make,
            ...(image.model && { model: image.model }),
          });
          await newCamera.save();
        } catch (err) {
          throw new ApolloError(err);
        }
      }
    }
  }
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
