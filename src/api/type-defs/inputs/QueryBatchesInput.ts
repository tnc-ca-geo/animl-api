export default `
  enum filterEnum {
    CURRENT
    COMPLETED
  }

  input QueryBatchesInput {
    filter: filterEnum
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
  }`;
