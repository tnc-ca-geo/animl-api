module.exports = `
  input Objects {
    _id: ID!
    bbox: [Float!]!,
    locked:  Boolean!,
    labels: [LabelData],
  }

  input UpdateObjectsInput {
    imageId: ID!
    objects:[Objects]
}`;
