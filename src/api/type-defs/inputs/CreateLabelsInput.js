export default `
  input ValidationInput {
    validated: Boolean!,
    validationDate: Date,
    userId: ID!,
  }

  input CreateLabelInput {
    _id: ID
    type: String!
    category: String!
    conf: Float
    bbox: [Float!]!
    labeledDate: Date
    validation: ValidationInput
    mlModel: String
    mlModelVersion: String
    userId: ID
    imageId: ID
    objectId: ID
  }

  input CreateLabelsInput {
    labels: [CreateLabelInput]!
  }
`;
