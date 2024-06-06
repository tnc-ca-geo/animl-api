export default /* GraphQL */ `
  input CreateUserInput {
    username: String!
    roles: [UserRole]!
  }
`;
