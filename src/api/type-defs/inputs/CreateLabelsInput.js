export default `
  input ValidationInput {
    validated: Boolean!,
    validationDate: Date,
    userId: ID!,
  }

  input LabelInput {
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
  }

  input CreateLabelsInput {
    imageId: ID!
    objectId: ID
    labels: [LabelInput!]
}`;
