// Field level resolvers for resolving possible query chains
// https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolver-chains
// https://www.apollographql.com/docs/tutorial/resolvers/

const Camera = {
  // Field level resolver for Camera.images()
  images: async (parent, args, context) => {
    console.log('Camera.images() resolver firing');
    return context.models.Image.queryByFilter({ cameras: [parent._id] });
  },
};

const Image = {
  // Field level resolver for Image.camera()
  camera: async (parent, __, context) => {
    console.log('Image.camera() resolver firing');
    const cameras = await context.models.Camera.getCameras([parent.cameraSn]);
    return cameras[0];
  }
};

module.exports = {
  Camera,
  Image,
};

