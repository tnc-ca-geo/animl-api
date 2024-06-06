export default /* GraphQL */ `
  input DeleteLabelInput {
    imageId: ID!
    objectId: ID!
    labelId: ID!
  }

  input DeleteLabelsInput {
    labels: [DeleteLabelInput]!
  }
`;
