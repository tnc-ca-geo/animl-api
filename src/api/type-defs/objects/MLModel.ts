export default /* GraphQL */ `
  type Categories {
    _id: String!
    name: String!
    color: String!
  }

  type MLModel {
    _id: String!
    description: String
    version: String!
    defaultConfThreshold: Float
    categories: [Categories]
  }
`;
