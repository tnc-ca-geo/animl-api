export default /* GraphQL */ `
  input UpdateBatchInput {
    _id: String!
    total: Int
    overrideSerial: String
    uploadComplete: Date
    ingestionComplete: Date
    processingEnd: Date
    processingStart: Date
    originalFile: String
    uploadedFile: String
  }
`;
