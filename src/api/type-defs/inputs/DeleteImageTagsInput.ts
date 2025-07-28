export default /* GraphQL */ `
  input DeleteTagInput {
    imageId: ID!
    tagId: ID!
  }

  input DeleteImageTagsInput {
    tags: [DeleteTagInput!]!
  }
`;
