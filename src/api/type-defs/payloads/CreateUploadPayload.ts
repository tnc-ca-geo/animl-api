export default /* GraphQL */ `
  type CreateUploadPayload {
    batch: String!
    multipartUploadId: String
    user: String!
    url: String
    urls: [String!]
  }
`;
