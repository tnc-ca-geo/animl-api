module.exports = `
  type Point {
    type: String!
    coordinates: [Int!]!
  }

  type Location {
    _id: ID!
    geometry: Point!
    altitude: String
    name: String
  }`;