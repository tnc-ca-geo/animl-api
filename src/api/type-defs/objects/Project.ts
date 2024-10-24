export default /* GraphQL */ `
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

  type ProjectLabel {
    _id: String!
    name: String!
    color: String!
    reviewerEnabled: Boolean!
    ml: Boolean!
  }

  type ProjectTag {
    _id: String!
    name: String!
    color: String!
  }

  type Project {
    _id: String!
    name: String!
    timezone: String!
    description: String
    views: [View!]!
    automationRules: [AutomationRule!]
    cameraConfigs: [CameraConfig!]
    labels: [ProjectLabel!]
    tags: [ProjectTag!]
    availableMLModels: [String!]
  }
`;
