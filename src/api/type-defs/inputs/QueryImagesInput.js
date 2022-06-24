module.exports = `
  input FiltersInput {
    createdStart: Date
    createdEnd: Date
    addedStart: Date
    addedEnd: Date
    cameras: [String!]
    deployments: [String!]
    labels: [String]
    reviewed: Boolean
    custom: String
  }

  input QueryImagesInput {
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
    filters: FiltersInput!
  }`;
