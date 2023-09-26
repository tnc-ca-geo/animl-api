export default `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    deleteImage(input: DeleteImageInput!): StandardPayload
    deleteImages(input: DeleteImagesInput!): StandardPayload

    createUpload(input: CreateUploadInput!): CreateUploadPayload
    updateBatch(input: UpdateBatchInput!): BatchPayload
    stopBatch(input: StopBatchInput!): StandardPayload
    redriveBatch(input: RedriveBatchInput!): StandardPayload

    createBatchError(input: CreateBatchErrorInput!): BatchError
    createImageError(input: CreateImageErrorInput!): ImageError
    clearImageErrors(input: ClearImageErrorsInput!): StandardPayload
    clearBatchErrors(input: ClearBatchErrorsInput!): StandardPayload

    registerCamera(input: RegisterCameraInput!): RegisterCameraPayload
    unregisterCamera(input: UnregisterCameraInput!): UnregisterCameraPayload

    createView(input: CreateViewInput!): CreateViewPayload
    updateView(input: UpdateViewInput!): UpdateViewPayload
    deleteView(input: DeleteViewInput!): DeleteViewPayload

    updateAutomationRules(input: UpdateAutomationRulesInput!): UpdateAutomationRulesPayload

    createObject(input: CreateObjectInput!): CreateObjectPayload
    updateObject(input: UpdateObjectInput!): UpdateObjectPayload
    deleteObject(input: DeleteObjectInput!): DeleteObjectPayload

    createLabels(input: CreateLabelsInput!): CreateLabelsPayload
    updateLabel(input: UpdateLabelInput!): UpdateLabelPayload
    deleteLabel(input: DeleteLabelInput!): DeleteLabelPayload

    createDeployment(input: CreateDeploymentInput!): CreateDeploymentPayload
    updateDeployment(input: UpdateDeploymentInput!): UpdateDeploymentPayload
    deleteDeployment(input: DeleteDeploymentInput!): DeleteDeploymentPayload
  }
`;
