export default `
  type Query {
    users(input: QueryUsersInput): UsersPayload
    tasks(input: QueryTasksInput): TasksPayload
    task(input: QueryTaskInput): Task
    projects(input: QueryProjectsInput): [Project]
    image(input: QueryImageInput!): Image
    images(input: QueryImagesInput!): ImagesConnection
    imageErrors(input: QueryImageErrorsInput!): ImageErrorsConnection
    labels: LabelList
    wirelessCameras(input: QueryWirelessCamerasInput): [WirelessCamera]
    mlModels(input: QueryMLModelsInput): [MLModel]
    batches(input: QueryBatchesInput!): BatchesConnection
    export(input: ExportInput!): ExportPayload
    exportErrors(input: ExportErrorsInput!): ExportPayload
    exportStatus(input: ExportStatusInput!): ExportStatusPayload
    stats(input: QueryStatsInput!): Task
  }
`;

