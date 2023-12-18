export default `
  type CreateUploadPayload {
    batch: String!
    user: String!
    url: String
    urls: [String]
    multipart: String
  }`;
