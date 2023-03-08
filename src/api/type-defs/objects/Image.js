module.exports = `
  type Image {
    _id: ID!
    batchId: Int
    bucket: String!
    fileTypeExtension: String!
    dateAdded: Date!
    dateTimeOriginal: Date!
    timezone: String!
    make: String!
    cameraId: String!
    deploymentId: ID!
    projectId: String!
    originalFileName: String
    imageWidth: Int
    imageHeight: Int
    mimeType: String
    userSetData: JSONObject
    model: String,
    location: Location
    objects: [Object]
  }`;
