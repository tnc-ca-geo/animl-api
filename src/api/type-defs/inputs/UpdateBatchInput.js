export default `
  input UpdateBatchInput {
    _id: String!
    total: Int
    overrideSerial: String
    uploadComplete: String
    ingestionComplete: String
    processingEnd: String
    processingStart: String
    originalFile: String
    uploadedFile: String
}`;
