export default `
  input ImageErrorsFilterInput {
    batch: String!
  }

  input QueryImageErrorsInput {
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
    filters: ImageErrorsFilterInput!
  }`;
