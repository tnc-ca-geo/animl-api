export default `
  input QueryBatchesInput {
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
    eTag: String
    user: String
  }`;
