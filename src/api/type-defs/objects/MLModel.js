module.exports = `
  type Categories {
    _id: String!
    name: String!
  }

  type MLModel {
    _id: String!
    description: String
    version: String!
    defaultConfThreshold: Float
    categories: [Categories]
  }
`;
