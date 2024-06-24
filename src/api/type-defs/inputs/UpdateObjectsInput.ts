export default /* GraphQL */ `
  input ObjectDiffsInput {
    locked: Boolean
    bbox: [Float!]
  }

  input ObjectUpdate {
    imageId: ID!
    objectId: ID!
    diffs: ObjectDiffsInput!
  }

  input UpdateObjectsInput {
    updates: [ObjectUpdate!]!
  }
`;
