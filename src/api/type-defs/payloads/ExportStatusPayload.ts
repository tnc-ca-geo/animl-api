export default /* GraphQL */ `
  type ExportError {
    message: String
  }

  type ExportStatusPayload {
    status: String!
    url: String
    count: Int
    meta: JSONObject
    error: [ExportError!]
  }
`;
