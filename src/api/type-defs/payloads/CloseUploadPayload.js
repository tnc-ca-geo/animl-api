export default `
  type CloseUploadPart {
    ETag: String!
    PartNumber: Int!
  }

  type CloseUploadPayload {
    id: String!
    multipart: String!
    parts: [CloseUploadPart]!
  }`;
