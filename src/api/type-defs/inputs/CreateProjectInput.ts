export default /* GraphQL */ `
  input CreateProjectInput {
    name: String!
    description: String!
    timezone: String!
    availableMLModels: [String]!
  }
`;
