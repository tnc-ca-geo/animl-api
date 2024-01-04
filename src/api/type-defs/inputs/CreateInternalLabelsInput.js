export default `
  input CreateInternalLabelInput {
    _id: ID
    type: String!
    labelId: String!
    conf: Float
    bbox: [Float!]!
    mlModel: String
    mlModelVersion: String
    imageId: ID
  }

  input CreateInternalLabelsInput {
    labels: [CreateInternalLabelInput]!
  }
`;
