// Field level resolvers for resolving possible query chains
// https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolver-chains
// https://www.apollographql.com/docs/tutorial/resolvers/

// TODO AUTH - are we using these?

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

// module.exports = {
//   Camera,
//   Image,
// };

