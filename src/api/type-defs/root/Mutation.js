export default `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    deleteImages(input: DeleteImagesInput!): StandardErrorPayload

    createImageComment(input: CreateImageCommentInput!): ImageCommentsPayload
    updateImageComment(input: UpdateImageCommentInput!): ImageCommentsPayload
    deleteImageComment(input: DeleteImageCommentInput!): ImageCommentsPayload

    createUser(input: CreateUserInput!): StandardPayload
    updateUser(input: UpdateUserInput!): StandardPayload

    createUpload(input: CreateUploadInput!): CreateUploadPayload
    closeUpload(input: CloseUploadInput!): StandardPayload

    updateBatch(input: UpdateBatchInput!): BatchPayload
    stopBatch(input: StopBatchInput!): StandardPayload
    redriveBatch(input: RedriveBatchInput!): StandardPayload

    createProject(input: CreateProjectInput!): ProjectPayload
    updateProject(input: UpdateProjectInput!): ProjectPayload

    createProjectLabel(input: CreateProjectLabelInput!): ProjectLabelPayload
    updateProjectLabel(input: UpdateProjectLabelInput!): ProjectLabelPayload
    deleteProjectLabel(input: DeleteProjectLabelInput!): StandardPayload

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

    createObjects(input: CreateObjectsInput!): StandardPayload
    updateObjects(input: UpdateObjectsInput!): StandardPayload
    deleteObjects(input: DeleteObjectsInput!): StandardPayload

    createInternalLabels(input: CreateInternalLabelsInput!): StandardPayload

    createLabels(input: CreateLabelsInput!): StandardPayload
    updateLabels(input: UpdateLabelsInput!): StandardPayload
    deleteLabels(input: DeleteLabelsInput!): StandardPayload

    createDeployment(input: CreateDeploymentInput!): CreateDeploymentPayload
    updateDeployment(input: UpdateDeploymentInput!): Task
    deleteDeployment(input: DeleteDeploymentInput!): DeleteDeploymentPayload
  }
`;
