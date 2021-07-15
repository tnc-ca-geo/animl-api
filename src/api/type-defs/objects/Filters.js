module.exports = `
  type Filters {
    cameras: [String]
    deployments: [String]
    labels: [String]
    createdStart: Date
    createdEnd: Date
    addedStart: Date
    addedEnd: Date
    reviewed: Boolean
  }
`;
