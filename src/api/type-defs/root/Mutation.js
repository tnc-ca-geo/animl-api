module.exports = `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    createView(input: CreateViewInput!): CreateViewPayload
    updateView(input: UpdateViewInput!): UpdateViewPayload
    deleteView(input: DeleteViewInput!): DeleteViewPayload
  }
`;
