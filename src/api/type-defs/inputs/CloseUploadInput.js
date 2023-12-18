export default `
  input CloseUploadPart {
    ETag: String!
    PartNumber: Int!
  }

  input CloseUploadInput {
    id: String!
    multipart: String!
    parts: [CloseUploadPart]!
  }`;
