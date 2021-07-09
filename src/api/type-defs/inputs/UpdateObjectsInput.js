module.exports = `
  input Objects {
    _id: ID!
    bbox: [Float!]!,
    locked:  Boolean!,
    labels: [LabelInput],
  }

  input UpdateObjectsInput {
    imageId: ID!
    objects:[Objects]
}`;
