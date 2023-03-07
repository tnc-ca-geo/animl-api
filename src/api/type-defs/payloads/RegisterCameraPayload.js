module.exports = `
  type RegisterCameraPayload {
    project: Project
    cameras: [Camera]
  }
`;

// TODO: if we decide to get more surgical with the update,
// return something like:

// module.exports = `
//   type RegisterCameraPayload {
//     cameraConfig: CameraConfig
//     cameraSource: Camera!
//   }
// `;
