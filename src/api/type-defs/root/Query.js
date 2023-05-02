module.exports = `
  type Query {
    projects(_ids: [String!]): [Project]
    image(input: QueryImageInput!): Image
    images(input: QueryImagesInput!): ImagesConnection
    labels: LabelList
    wirelessCameras(_ids: [String!]): [WirelessCamera]
    mlModels(_ids: [String!]): [MLModel]
    batches(input: QueryBatchesInput!): BatchesConnection
    batch(_id: String!): Batch
    stats(input: QueryStatsInput!): ImagesStats
    export(input: ExportInput!): ExportPayload
    exportStatus(input: ExportStatusInput!): ExportStatusPayload
    priorityStatus: PriorityStatusPayload
  }
`;

