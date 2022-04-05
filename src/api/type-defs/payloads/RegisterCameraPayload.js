module.exports = `
  type RegisterCameraPayload {
    cameraId: ID!
    project: Project
    cameras: [Camera]
  }
`;
