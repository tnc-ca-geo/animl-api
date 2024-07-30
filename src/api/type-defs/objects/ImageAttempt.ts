export default /* GraphQL */ `
  type ImageMetadata {
    _id: ID!
    bucket: String
    batchId: String
    fileTypeExtension: String
    path: String
    dateAdded: Date
    dateTimeOriginal: Date
    timezone: String
    make: String
    cameraId: String
    originalFileName: String
    imageWidth: Int
    imageHeight: Int
    imageBytes: Int
    mimeType: String
    model: String
  }

  type ImageAttempt {
    _id: ID!
    projectId: String!
    batch: String
    created: Date!
    metadata: ImageMetadata
    errs: [ImageError!]
  }
`;
