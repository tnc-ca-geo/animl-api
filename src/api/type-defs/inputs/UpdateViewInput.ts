export default /* GraphQL */ `
  input ViewDiffsInput {
    name: String
    description: String
    filters: FiltersInput
  }

  input UpdateViewInput {
    viewId: ID!
    diffs: ViewDiffsInput!
  }
`;
