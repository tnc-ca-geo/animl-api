export default `
  input DeleteObjectInput {
    imageId: ID!
    objectId: ID!
  }

  input DeleteObjectsInput {
    objects: [DeleteObjectInput]!
  }
`;
