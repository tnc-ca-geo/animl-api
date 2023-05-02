module.exports = `
  input UpdateBatchInput {
    _id: String!
    eTag: String
    total: Int
    processingEnd: String
    processingStart: String
    originalFile: String
    uploadedFile: String
}`;
