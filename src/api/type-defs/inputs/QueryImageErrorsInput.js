export default `
  input ImageErrorsFilterInput {
    batch: String!
    custom: String
  }

  input QueryImageErrorsInput {
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
    filters: ImageErrorsFilterInput!
  }`;
