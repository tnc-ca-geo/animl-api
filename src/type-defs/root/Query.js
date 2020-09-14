module.exports = `
  type Query {
    image(_id: ID!): Image
    images(createdStart: Date, createdEnd: Date, cameras: [String!]): [Image]
  }
`;
