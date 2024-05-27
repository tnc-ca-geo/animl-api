export default `
  type Task {
    _id: ID!
    user: String!
    projectId: String!
    type: String!
    status: String!
    created: Date!
    updated: Date!
    output: JSONObject
  }`;
