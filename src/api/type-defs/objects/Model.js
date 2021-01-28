module.exports = `
  type Model {
    _id: ID!
    name: String!
    description: String
    version: String
    renderThreshold: Float
    categories: JSONObject
    performance: JSONObject
  }`;

// TODO: figure out model performance schema