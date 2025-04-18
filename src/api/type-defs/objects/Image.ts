export default /* GraphQL */ `
  type Image {
    _id: ID!
    batchId: String
    errors: [ImageError!]
    bucket: String!
    fileTypeExtension: String!
    path: String
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
    imageBytes: Int
    mimeType: String
    userSetData: JSONObject
    model: String
    location: Location
    reviewed: Boolean
    objects: [Object!]
    comments: [ImageComment!]
    tags: [ID!]
  }
`;
