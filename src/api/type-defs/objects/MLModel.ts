export default /* GraphQL */ `
  type Category {
    _id: String!
    name: String!
    color: String!
    taxonomy: String
  }

  type MLModel {
    _id: String!
    description: String
    version: String!
    defaultConfThreshold: Float
    categories: [Category!]!
    expectsCrops: Boolean!
  }
`;
