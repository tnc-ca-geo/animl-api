export default /* GraphQL */ `
  type View {
    _id: ID!
    name: String!
    filters: Filters!
    description: String
    editable: Boolean
  }
`;
