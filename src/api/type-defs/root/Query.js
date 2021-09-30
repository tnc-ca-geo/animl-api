module.exports = `
  type Query {
    image(input: QueryImageInput!): Image
    images(input: QueryImagesInput!): ImagesConnection
    labels: LabelList
    cameras(_ids: [String!]): [Camera]
    views(_ids: [String!]): [View]
    models(_ids: [String!]): [Model]
  }
`;

/*
 * limit - The number of results to show. Must be >= 1. Default = 20
 * offset - If you add a cursor here, it will only return results after it
 */

