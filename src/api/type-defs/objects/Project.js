// NEW - add project type-def
module.exports = `
  type Deployment {
    _id: ID!
    name: String!
    description: String
    timezone: String
    location: Location
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
    cameras: CameraConfig
    availableMLModels: [String]
  }
`;
