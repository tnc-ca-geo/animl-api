export default /* GraphQL */ `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    deleteImages(input: DeleteImagesInput!): StandardErrorPayload
    deleteImagesTask(input: DeleteImagesInput!): Task
    deleteImagesByFilterTask(input: DeleteImagesByFilterTaskInput!): Task
    setTimestampOffsetBatchTask(input: SetTimestampOffsetBatchTaskInput!): Task
    setTimestampOffsetByFilterTask(input: SetTimestampOffsetByFilterTaskInput!): Task

    createImageComment(input: CreateImageCommentInput!): ImageCommentsPayload
    updateImageComment(input: UpdateImageCommentInput!): ImageCommentsPayload
    deleteImageComment(input: DeleteImageCommentInput!): ImageCommentsPayload
    setTimestampOffset(input: SetTimestampOffsetInput!): StandardPayload

    createUser(input: CreateUserInput!): StandardPayload
    updateUser(input: UpdateUserInput!): StandardPayload
    resendTempPassword(input: ResendTempPasswordInput!): StandardPayload

    createUpload(input: CreateUploadInput!): CreateUploadPayload
    closeUpload(input: CloseUploadInput!): StandardPayload

    updateBatch(input: UpdateBatchInput!): BatchPayload
    stopBatch(input: StopBatchInput!): StandardPayload
    redriveBatch(input: RedriveBatchInput!): StandardPayload

    createProject(input: CreateProjectInput!): ProjectPayload
    updateProject(input: UpdateProjectInput!): ProjectPayload

    createProjectLabel(input: CreateProjectLabelInput!): ProjectLabelPayload
    updateProjectLabel(input: UpdateProjectLabelInput!): ProjectLabelPayload
    deleteProjectLabel(input: DeleteProjectLabelInput!): DeleteProjectLabelPayload

    createProjectTag(input: CreateProjectTagInput!): ProjectTagsPayload
    deleteProjectTag(input: DeleteProjectTagInput!): ProjectTagsPayload
    updateProjectTag(input: UpdateProjectTagInput!): ProjectTagsPayload

    createImageTags(input: CreateImageTagsInput!): StandardPayload
    deleteImageTags(input: DeleteImageTagsInput!): StandardPayload

    createBatchError(input: CreateBatchErrorInput!): BatchError
    createImageError(input: CreateImageErrorInput!): ImageError
    clearImageErrors(input: ClearImageErrorsInput!): StandardPayload
    clearBatchErrors(input: ClearBatchErrorsInput!): StandardPayload

    registerCamera(input: RegisterCameraInput!): RegisterCameraPayload
    unregisterCamera(input: UnregisterCameraInput!): UnregisterCameraPayload
    updateCameraSerialNumber(input: UpdateCameraSerialNumberInput!): Task
    deleteCameraConfig(input: DeleteCameraInput!): Task

    createView(input: CreateViewInput!): CreateViewPayload
    updateView(input: UpdateViewInput!): UpdateViewPayload
    deleteView(input: DeleteViewInput!): DeleteViewPayload

    updateAutomationRules(input: UpdateAutomationRulesInput!): UpdateAutomationRulesPayload

    createObjects(input: CreateObjectsInput!): StandardPayload
    updateObjects(input: UpdateObjectsInput!): StandardPayload
    deleteObjects(input: DeleteObjectsInput!): StandardPayload

    createInternalLabels(input: CreateInternalLabelsInput!): StandardPayload
    updatePredictionStatus(input: UpdatePredictionStatusInput!): StandardPayload

    createLabels(input: CreateLabelsInput!): StandardPayload
    updateLabels(input: UpdateLabelsInput!): StandardPayload
    deleteLabels(input: DeleteLabelsInput!): StandardPayload

    createDeployment(input: CreateDeploymentInput!): Task
    updateDeployment(input: UpdateDeploymentInput!): Task
    deleteDeployment(input: DeleteDeploymentInput!): Task
  }
`;
