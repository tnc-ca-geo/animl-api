export default /* GraphQL */ `
  enum UserRole {
    manager
    member
    observer
  }

  type User {
    roles: [UserRole!]!
    username: String!
    email: String
    created: Date
    updated: Date
    enabled: Boolean
    status: String
  }
`;
