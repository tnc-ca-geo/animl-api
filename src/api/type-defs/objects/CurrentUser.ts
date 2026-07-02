export default /* GraphQL */ `
  enum DeploymentSortOrder {
    dateAdded
    alphabetical
  }

  type ProjectSortPreference {
    projectId: String!
    sortOrder: DeploymentSortOrder!
  }

  type UserPreferences {
    deploymentsSortOrder: [ProjectSortPreference!]!
  }

  type CurrentUser {
    username: String!
    updated: Date
    preferences: UserPreferences!
  }
`;
