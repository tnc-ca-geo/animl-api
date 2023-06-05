module.exports = `
  input UpdateBatchInput {
    _id: String!
    eTag: String
    total: Int
    overrideSerial: String
    processingEnd: String
    processingStart: String
    originalFile: String
    uploadedFile: String
}`;
