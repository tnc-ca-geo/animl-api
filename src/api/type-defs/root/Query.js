module.exports = `
  type Query {
    projects(_ids: [String!]): [Project]
    image(input: QueryImageInput!): Image
    images(input: QueryImagesInput!): ImagesConnection
    labels: LabelList
    cameras(_ids: [String!]): [Camera]
    mlModels(_ids: [String!]): [MLModel]
    batches(_ids: [String!]): [Batch]
    batch(_id: String!): Batch
    stats(input: QueryStatsInput!): ImagesStats
    export(input: ExportInput!): ExportPayload
    exportStatus(input: ExportStatusInput!): ExportStatusPayload
  }
`;

