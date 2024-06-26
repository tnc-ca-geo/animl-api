export default /* GraphQL */ `
  enum UserRole {
    manager
    member
    observer
  }

  type User {
    roles: [UserRole!]!
    username: String!
    email: String!
    created: String!
    updated: String!
    enabled: Boolean!
    status: String!
  }
`;
