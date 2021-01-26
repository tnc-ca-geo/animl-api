module.exports = `
  input FiltersInput {
    cameras: [String]
    labels: [String]
    createdStart: Date
    createdEnd: Date
    addedStart: Date
    addedEnd: Date
  }

  input CreateViewInput {
    filters: FiltersInput!
    name: String!
    description: String
    editable: Boolean!
}`;
