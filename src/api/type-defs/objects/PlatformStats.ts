export default /* GraphQL */ `
  type PlatformMetrics {
    totalProjects: Int!
    totalImages: Int!
    totalImagesReviewed: Int!
    totalImagesNotReviewed: Int!
    totalUsers: Int!
    totalCameras: Int!
  }

  type ProjectMetrics {
    projectId: String!
    projectName: String!
    imageCount: Int!
    imagesReviewed: Int!
    imagesNotReviewed: Int!
    cameraCount: Int!
    userCount: Int!
    imagesAddedSinceLastSnapshot: Int!
  }

  type PlatformStatsSnapshot {
    _id: ID!
    snapshotDate: Date!
    platform: PlatformMetrics!
    projects: [ProjectMetrics!]!
  }
`;
