module.exports = `
  type ProjectRegistration {
    _id: ID!
    projectId: String!
    active: Boolean!
  }

  type WirelessCamera {
    _id: String!
    make: String!
    model: String
    projRegistrations: [ProjectRegistration!]!
  }
`;
