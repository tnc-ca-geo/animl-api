// NEW - add project type-def
module.exports = `
  type CameraConfig {
    _id: String!
    deployments: [Deployment!]!
  }

  type Project {
    _id: String!
    name: String!
    timezone: String!
    description: String
    views: [Views!]!
    cameras: CameraConfig
    availableMLModels: [String]
  }
`;
