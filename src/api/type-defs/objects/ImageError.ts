export default /* GraphQL */ `
  type ImageError {
    _id: String!
    batch: String
    image: String
    path: String
    error: String!
    created: Date!
  }
`;
