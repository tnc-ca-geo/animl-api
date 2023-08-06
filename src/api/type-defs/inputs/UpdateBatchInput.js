export default `
  input UpdateBatchInput {
    _id: String!
    total: Int
    overrideSerial: String
    processingEnd: String
    processingStart: String
    originalFile: String
    uploadedFile: String
}`;
