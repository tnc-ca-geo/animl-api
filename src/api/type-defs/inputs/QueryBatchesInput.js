export default `
  enum statusEnum {
    CURRENT
    COMPLETED
  }

  input QueryBatchesInput {
    status: statusEnum
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
  }`;
