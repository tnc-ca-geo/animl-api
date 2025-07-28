export default /* GraphQL */ `
  input CreateTagInput {
    imageId: ID!
    tagId: ID!
  }

  input CreateImageTagsInput {
    tags: [CreateTagInput!]!
  }
`;
