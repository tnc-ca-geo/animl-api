module.exports = `
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
    modelId: ID
    userId: ID
  }

  input CreateLabelsInput {
    imageId: ID!
    labels: [LabelInput!]
}`;
