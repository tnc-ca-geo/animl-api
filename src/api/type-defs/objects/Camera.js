module.exports = `
  type Deployment {
    _id: ID!
    name: String!
    description: String
    location: Location
    startDate: Date
    editable: Boolean
  }

  type Camera {
    _id: String!
    make: String!
    model: String
    images: [Image]
    deployments: [Deployment!]
  }`;