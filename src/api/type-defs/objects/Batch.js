export default `
  type Batch {
    _id: String!
    projectId: String!
    errors: [BatchError]
    imageErrors: Int
    uploadComplete: String
    ingestionComplete: String
    processingStart: String
    processingEnd: String
    overrideSerial: String
    originalFile: String
    uploadedFile: String
    remaining: Int
    dead: Int
    total: Int
  }
`;
