export default `
  input QueryBatchesInput {
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
    user: String
  }`;
