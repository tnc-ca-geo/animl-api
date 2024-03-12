export default `
  type Task {
    _id: ID!
    user: String!
    projectId: String!
    type: String!
    status: String!
    config: Object!
    created: String!
    updated: String!
    output: Object
  }`;
