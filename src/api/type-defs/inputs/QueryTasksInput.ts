export default /* GraphQL */ `
  input QueryTasksInput {
    paginatedField: String
    sortAscending: Boolean
    limit: Int
    next: String
    previous: String
  }
`;
