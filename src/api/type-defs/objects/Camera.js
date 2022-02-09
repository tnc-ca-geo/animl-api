module.exports = `
  type ProjectRegistration {
    _id: ID!
    project: String!
    active: Boolean!
  }

  type Camera {
    _id: String!
    make: String!
    model: String
    projRegistrations: [ProjectRegistration!]!
  }
`;