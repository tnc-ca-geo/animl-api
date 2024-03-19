export default `
  type Task {
    _id: ID!
    user: String!
    projectId: String!
    type: String!
    status: String!
    created: String!
    updated: String!
    output: JSONObject
  }`;
