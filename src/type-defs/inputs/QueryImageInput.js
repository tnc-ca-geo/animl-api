module.exports = `
  input QueryImageInput {
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
    createdStart: Date
    createdEnd: Date
    cameras: [String!]
  }`;
