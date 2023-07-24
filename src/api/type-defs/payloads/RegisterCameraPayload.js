export default `
  type RegisterCameraPayload {
    project: Project
    wirelessCameras: [WirelessCamera]
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
