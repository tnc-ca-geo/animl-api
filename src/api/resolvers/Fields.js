// Field level resolvers for resolving possible query chains
// https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolver-chains
// https://www.apollographql.com/docs/tutorial/resolvers/

// const Camera = {
//   // Field level resolver for Camera.images()
//   images: async (parent, __, context) => {
//     return context.models.Image.queryByFilter({ cameras: [parent._id] });
//   },
// };

// const Image = {
//   // Field level resolver for Image.camera()
//   camera: async (parent, __, context) => {
//     const cameras = await context.models.Camera.getCameras([parent.cameraSn]);
//     return cameras[0];
//   }
// };

const Project = {
  // Field level resolver for Project.labels()
  labels: async (parent, __, context) => {
    return await context.models.Image.getLabels(parent._id);
  }
}

module.exports = {
  Project,
  // Camera,
  // Image,
};

