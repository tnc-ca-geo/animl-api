module.exports = `
  type ExportStatusPayload {
    status: String!
    urls: [String]
    imageCount: Int
    reviewedCount: ReviewedCount
    error: String
  }`;
