module.exports = `
  type Query {
    projects(_ids: [String!]): [Project]
    image(input: QueryImageInput!): Image
    images(input: QueryImagesInput!): ImagesConnection
    labels: LabelList
    cameras(_ids: [String!]): [Camera]
    mlModels(_ids: [String!]): [MLModel]
    stats(input: QueryStatsInput!): ImagesStats
    csv(input: ExportCSVInput!): ExportCSVPayload
  }
`;

