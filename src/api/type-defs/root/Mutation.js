module.exports = `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    createLabel(input: CreateLabelInput!): CreateLabelPayload
    createView(input: CreateViewInput!): CreateViewPayload
    updateView(input: UpdateViewInput!): UpdateViewPayload
    deleteView(input: DeleteViewInput!): DeleteViewPayload
  }
`;
