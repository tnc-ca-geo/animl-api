module.exports = `
  input LabelData {
    _id: ID
    type: String!
    category: String!
    conf: Float
    bbox: [Float!]!
    modelId: ID
  }

  input CreateLabelsInput {
    imageId: ID!
    labels: [LabelData!]
}`;

// TODO: add userId to LabelData
