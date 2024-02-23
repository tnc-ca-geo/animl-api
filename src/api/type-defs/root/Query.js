export default `
  type Query {
    users(input: QueryUsersInput): UsersPayload
    projects(input: QueryProjectsInput): [Project]
    image(input: QueryImageInput!): Image
    images(input: QueryImagesInput!): ImagesConnection
    imageErrors(input: QueryImageErrorsInput!): ImageErrorsConnection
    labels: LabelList
    wirelessCameras(input: QueryWirelessCamerasInput): [WirelessCamera]
    mlModels(input: QueryMLModelsInput): [MLModel]
    batches(input: QueryBatchesInput!): BatchesConnection
    stats(input: QueryStatsInput!): ImagesStats
    export(input: ExportInput!): ExportPayload
    exportErrors(input: ExportErrorsInput!): ExportPayload
    exportStatus(input: ExportStatusInput!): ExportStatusPayload
  }
`;

