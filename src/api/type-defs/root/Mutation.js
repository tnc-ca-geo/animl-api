module.exports = `
  type Mutation {
    createImage(input: CreateImageInput!): CreateImagePayload

    createView(input: CreateViewInput!): CreateViewPayload
    updateView(input: UpdateViewInput!): UpdateViewPayload
    deleteView(input: DeleteViewInput!): DeleteViewPayload
    
    createObject(input: CreateObjectInput!): CreateObjectPayload
    updateObject(input: UpdateObjectInput!): UpdateObjectPayload
    deleteObject(input: DeleteObjectInput!): DeleteObjectPayload
    
    createLabels(input: CreateLabelsInput!): CreateLabelsPayload
    updateLabel(input: UpdateLabelInput!): UpdateLabelPayload
    deleteLabel(input: DeleteLabelInput!): DeleteLabelPayload
  }
`;

// TODO: add CUD handlers for deployments
// createDeployment(input: {cameraId, deployment})
// updateDeployment(input: {cameraId, deploymentId, diffs})
// deleteDeployment(input: {cameraId, deploymentId, diffs})