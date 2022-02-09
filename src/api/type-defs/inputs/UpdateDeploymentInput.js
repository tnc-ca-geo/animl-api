module.exports = `
  input DeploymentDiffsInput {
    name: String
    description: String
    location: LocationInput
    startDate: Date
    editable: Boolean
  }

  input UpdateDeploymentInput {
    cameraId: ID!
    deploymentId: ID!
    diffs: DeploymentDiffsInput!
  }
`; 