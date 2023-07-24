export default `
  input ViewDiffsInput {
    name: String
    description: String
    filters: FiltersInput
  }

  input UpdateViewInput {
    viewId: ID!
    diffs: ViewDiffsInput!
}`;

// TODO: in CreateLabelsInput and UpdateObjectsInput, we use imageId: ID!
// to id the image. Might want to do that here too for consistency?
// but call it viewId of course
