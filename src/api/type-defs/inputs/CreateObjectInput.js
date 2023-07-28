export default `
  input ObjectInput {
    _id: ID!
    bbox: [Float!]
    locked: Boolean!
    labels: [LabelInput]
  }

  input CreateObjectInput {
    imageId: ID!
    object: ObjectInput!
}`;
