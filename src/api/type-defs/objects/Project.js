module.exports = `
  type Deployment {
    _id: ID!
    name: String!
    description: String
    location: Location
    timezone: String!
    startDate: Date
    editable: Boolean
  }

  type CameraConfig {
    _id: String!
    deployments: [Deployment!]!
  }

  type Project {
    _id: String!
    name: String!
    timezone: String!
    description: String
    views: [View!]!
    automationRules: [AutomationRule]
    cameraConfigs: [CameraConfig]
    labels: LabelList
    availableMLModels: [String]
  }
`;
