const Camera = require('../schemas/Camera');

const generateCameraModel = () => ({

  getCameras: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const cameras = await Camera.find(query);
      return cameras;
    } catch (err) {
      throw new Error(err);
    }
  },

  get createCamera() {  // use object getter so we can reference this.getCameras
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
          throw new Error(err);
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
