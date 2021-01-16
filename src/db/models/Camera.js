const Camera = require('../schemas/Camera');

// TODO: I don't know that we need to try to reconnect to the DB before 
// every single db operation. It would be worth experiementing w/ only 
// connecting once in the context creation function...

const generateCameraModel = () => ({

  getAll: async () => { 
    console.log('Getting all cameras');
    try {
      const cameras = await Camera.find({});
      console.log('Found cameras: ', cameras);
      return cameras;
    } catch (err) {
      throw new Error(err);
    }
   },

  queryByIds: async (_ids) => {
    console.log('Getting cameras by Ids: ', _ids);
    try {
      cameras = await Camera.find({ _id: { $in: _ids } });
      console.log('Found cameras: ', cameras);
      return cameras;
    } catch (err) {
      throw new Error(err);
    }
  },

  get createCamera() {  // use object getter so we can reference this.queryByIds
    return async (image) => {
      const existingCam = await this.queryByIds([ image.cameraSn ]);
      if (existingCam.length === 0) {
        console.log('Creating new camera document');
        const newCamera = new Camera({
          _id: image.cameraSn,
          make: image.make,
          ...(image.model && { model: image.model }),
        });
        await newCamera.save();
        console.log('successfully saved camera: ', newCamera);
      }
      else {
        console.log('Camera record already exists: ', existingCam);
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
