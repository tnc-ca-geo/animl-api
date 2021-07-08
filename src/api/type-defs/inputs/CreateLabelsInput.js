module.exports = `
  input ValidationInput {
    validated: Boolean!,
    validationDate: Date,
    user: ID,
  }

  input LabelData {
    _id: ID
    type: String!
    category: String!
    conf: Float
    bbox: [Float!]!
    validation: ValidationInput
    modelId: ID
  }

  input CreateLabelsInput {
    imageId: ID!
    labels: [LabelData!]
}`;

// TODO: add userId to LabelData
