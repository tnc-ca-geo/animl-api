export default `
  type ExportError {
    message: String
  }

  type ExportStatusPayload {
    status: String!
    url: String
    imageCount: Int
    reviewedCount: ReviewedCount
    error: [ExportError]
  }`;
