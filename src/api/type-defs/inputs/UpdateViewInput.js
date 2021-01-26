module.exports = `
  input ViewDiffsInput {
    name: String
    description: String
    filters: FiltersInput
  }

  input UpdateViewInput {
    _id: ID!
    diffs: ViewDiffsInput!
}`;
