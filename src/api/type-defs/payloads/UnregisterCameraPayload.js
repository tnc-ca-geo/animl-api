module.exports = `
  type UnregisterCameraPayload {
    success: Boolean!
    rejectionInfo: RegistrationRejection
    cameraId: ID!
    cameras: [Camera]
  }
`;

// TODO AUTH - what else to return here?
// Info if registration is rejected would be nice 
// (email address of admin of currently registered project maybe?)