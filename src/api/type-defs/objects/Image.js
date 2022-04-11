module.exports = `
  type Image {
    _id: ID!
    bucket: String!
    fileTypeExtension: String!
    dateAdded: Date!
    dateTimeOriginal: Date!
    make: String!
    cameraId: String!
    deployment: ID!
    project: String!
    originalFileName: String
    imageWidth: Int
    imageHeight: Int
    mimeType: String
    userSetData: JSONObject
    model: String,
    location: Location
    objects: [Object]
    camera: Camera
  }`;


// TODO: decide if we want to populate() cameraId field when returning 
// an Image - in which case I think we use cameraId: Camera!
// I also don't think we need camera: Camera? double check
