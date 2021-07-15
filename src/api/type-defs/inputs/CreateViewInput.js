module.exports = `
  input FiltersInput {
    cameras: [String]
    deployments: [String]
    labels: [String]
    createdStart: Date
    createdEnd: Date
    addedStart: Date
    addedEnd: Date
    reviewed: Boolean 
  }

  input CreateViewInput {
    filters: FiltersInput!
    name: String!
    description: String
    editable: Boolean!
}`;
