export default /* GraphQL */ `
  input CloseUploadPart {
    ETag: String!
    PartNumber: Int!
  }

  input CloseUploadInput {
    batchId: String!
    multipartUploadId: String!
    parts: [CloseUploadPart!]!
  }
`;
