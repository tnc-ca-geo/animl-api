export default /* GraphQL */ `
  type Point {
    type: String!
    coordinates: [Float!]!
  }

  type Location {
    _id: ID!
    geometry: Point!
    altitude: String
    name: String
  }
`;
