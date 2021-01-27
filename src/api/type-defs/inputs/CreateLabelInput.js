module.exports = `
  input LabelData {
    type: String!
    category: String!
    conf: Float
    bbox: [Float!]!
    modelId: ID
  }

  input CreateLabelInput {
    imageId: ID!
    label: LabelData!
}`;

// TODO: add userId to LabelData
