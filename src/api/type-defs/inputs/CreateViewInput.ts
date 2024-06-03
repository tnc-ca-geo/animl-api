export default /* GraphQL */ `
  input CreateViewInput {
    filters: FiltersInput!
    name: String!
    description: String
    editable: Boolean!
  }
`;
