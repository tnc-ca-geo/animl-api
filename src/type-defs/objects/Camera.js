module.exports = `
  type Camera {
    _id: ID!
    make: String!
    model: String
    serialNumber: String!
    images: [Image!]
  }`;