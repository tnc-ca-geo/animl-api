module.exports = `
  type Query {
    image(_id: ID!): Image
    images(
      limit: Int
      offset: Int
      createdStart: Date
      createdEnd: Date
      cameras: [String!]
    ): ImageConnection
    cameras(_ids: [String!]): [Camera]
  }
`;

/*
 * limit - The number of results to show. Must be >= 1. Default = 20
 * offset - If you add a cursor here, it will only return results after it
 */

