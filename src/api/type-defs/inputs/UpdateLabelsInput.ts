export default /* GraphQL */ `
  input LabelDiffsInput {
    locked: Boolean
    validation: ValidationInput
  }

  input LabelUpdate {
    imageId: ID!
    objectId: ID!
    labelId: ID!
    diffs: LabelDiffsInput!
  }

  input UpdateLabelsInput {
    updates: [LabelUpdate!]!
  }
`;
