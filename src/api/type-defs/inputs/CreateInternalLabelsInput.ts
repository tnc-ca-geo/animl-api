export default /* GraphQL */ `
  input CreateInternalLabelInput {
    labelId: String!
    conf: Float
    bbox: [Float!]!
    mlModel: String!
    mlModelVersion: String!
  }

  input CreateInternalLabelsInput {
    imageId: ID!
    labels: [CreateInternalLabelInput!]!
  }
`;
