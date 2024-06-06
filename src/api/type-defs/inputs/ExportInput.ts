export default /* GraphQL */ `
  enum Format {
    csv
    coco
  }

  input ExportInput {
    format: Format!
    filters: FiltersInput!
  }
`;
