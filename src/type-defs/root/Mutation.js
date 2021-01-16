module.exports = `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    createView(input: CreateViewInput!): CreateViewPayload
  }
`;
