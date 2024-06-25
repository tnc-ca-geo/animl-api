export default /* GraphQL */ `
  input CreateInternalLabelInput {
    labelId: String!
    conf: Float
    bbox: [Float!]!
    mlModel: String!
    mlModelVersion: String!
    imageId: ID
  }

  input CreateInternalLabelsInput {
    labels: [CreateInternalLabelInput!]!
  }
`;
