export default /* GraphQL */ `
  input UpdateProjectInput {
    name: String
    description: String
    type: ProjectType
    stage: ProjectStage
    organization: String
    location: LocationInput
    country: String
    state_province: String
  }
`;
