module.exports = `
  input RegisterCameraInput {
    cameraId: ID!
    make: String!
  }
`; 

// TODO AUTH - do we need anything else here?
// TODO AUTH - validate make as enum here (e.g. BuckEyeCam / RECONYX / others)? 
// we don't really do it for CreateImageInput anywhere and unfortunately 
// can't do it in the CreateImageInput type def b/c we're acceping any 
// JSON object as image metadata.