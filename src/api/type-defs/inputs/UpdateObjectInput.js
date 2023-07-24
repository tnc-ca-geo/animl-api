export default `
  input ObjectDiffsInput {
    locked: Boolean
    bbox: [Float!]
  }

  input UpdateObjectInput {
    imageId: ID!
    objectId: ID!
    diffs: ObjectDiffsInput!
}`;
