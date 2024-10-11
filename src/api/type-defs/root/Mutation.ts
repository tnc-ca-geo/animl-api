export default /* GraphQL */ `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload
    deleteImages(input: DeleteImagesInput!): StandardErrorPayload
    deleteImagesTask(input: DeleteImagesInput!): Task
    deleteImagesByFilterTask(input: DeleteImagesByFilterTaskInput!): Task

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

    createProjectTag(input: CreateProjectTagInput!): ProjectTagsPayload
    deleteProjectTag(input: DeleteProjectTagInput!): ProjectTagsPayload
    updateProjectTag(input: UpdateProjectTagInput!): ProjectTagsPayload

    createImageTag(input: CreateImageTagInput!): ImageTagsPayload
    deleteImageTag(input: DeleteImageTagInput!): ImageTagsPayload

    createBatchError(input: CreateBatchErrorInput!): BatchError
    createImageError(input: CreateImageErrorInput!): ImageError
    clearImageErrors(input: ClearImageErrorsInput!): StandardPayload
    clearBatchErrors(input: ClearBatchErrorsInput!): StandardPayload

    registerCamera(input: RegisterCameraInput!): RegisterCameraPayload
    unregisterCamera(input: UnregisterCameraInput!): UnregisterCameraPayload
    updateCameraSerialNumber(input: UpdateCameraSerialNumberInput!): Task
    deleteCamera(input: DeleteCameraInput!): Task

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

    createDeployment(input: CreateDeploymentInput!): Task
    updateDeployment(input: UpdateDeploymentInput!): Task
    deleteDeployment(input: DeleteDeploymentInput!): Task
  }
`;
