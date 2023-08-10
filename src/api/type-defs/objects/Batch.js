export default `
  type Batch {
    _id: String!
    projectId: String!
    errors: [BatchError]
    imageErrors: Int
    uploadComplete: Date
    ingestionComplete: Date
    processingStart: Date
    processingEnd: Date
    overrideSerial: String
    originalFile: String
    uploadedFile: String
    remaining: Int
    dead: Int
    total: Int
  }
`;
