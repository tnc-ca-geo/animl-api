export default /* GraphQL */ `
  input ValidationInput {
    validated: Boolean!
    validationDate: Date
    userId: ID!
  }

  input CreateLabelInput {
    _id: ID
    labelId: String!
    conf: Float
    bbox: [Float!]!
    labeledDate: Date
    validation: ValidationInput
    userId: ID
    imageId: ID!
    objectId: ID!
    mlModel: String
  }

  input CreateLabelsInput {
    labels: [CreateLabelInput!]!
  }
`;
