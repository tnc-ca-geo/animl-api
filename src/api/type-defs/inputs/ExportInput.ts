export default /* GraphQL */ `
  enum Format {
    csv
    coco
  }

  input ExportInput {
    format: Format!
    timezone: String!
    filters: FiltersInput!
    onlyIncludeReviewed: Boolean!
  }
`;
