export default /* GraphQL */ `
  input PointInput {
    type: String!
    coordinates: [Float!]!
  }

  input LocationInput {
    _id: ID!
    geometry: PointInput!
    altitude: String
    name: String
  }

  input DeploymentInput {
    _id: ID!
    name: String!
    description: String
    location: LocationInput
    timezone: String!
    startDate: Date!
    editable: Boolean
  }

  input CreateDeploymentInput {
    cameraId: ID!
    deployment: DeploymentInput!
  }
`;
