module.exports = `
  type Batch {
    _id: String!
    projectId: String!
    eTag: String
    errors: [BatchError]
    processingStart: String
    processingEnd: String
    originalFile: String
    uploadedfile: String
    remaining: Int
    dead: Int
    total: Int
  }
`;
