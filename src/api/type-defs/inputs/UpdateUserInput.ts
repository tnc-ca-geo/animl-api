export default /* GraphQL */ `
  input UpdateUserInput {
    username: String!
    roles: [UserRole!]!
  }
`;
