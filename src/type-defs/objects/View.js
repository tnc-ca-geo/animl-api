module.exports = `
  type Filters {
    cameras: [String]
    labels: [String]
    createdStart: Date
    createdEnd: Date
    addedStart: Date
    addedEnd: Date
  }

  type View {
    name: String!
    filters: Filters!
    description: String
  }
`;
