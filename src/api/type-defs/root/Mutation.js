module.exports = `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    createLabels(input: CreateLabelsInput!): CreateLabelsPayload
    createView(input: CreateViewInput!): CreateViewPayload
    updateView(input: UpdateViewInput!): UpdateViewPayload
    deleteView(input: DeleteViewInput!): DeleteViewPayload
    updateObjects(input: UpdateObjectsInput!): UpdateObjectsPayload
  }
`;
