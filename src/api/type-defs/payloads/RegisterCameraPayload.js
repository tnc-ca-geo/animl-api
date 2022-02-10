module.exports = `
  type RegistrationRejection {
    msg: String!,
    currProjReg: String!,
  }

  type RegisterCameraPayload {
    success: Boolean!
    rejectionInfo: RegistrationRejection
    cameraId: ID!
  }
`;

// TODO AUTH - what else to return here?
// Info if registration is rejected would be nice 
// (email address of admin of currently registered project maybe?)