export default /* GraphQL */ `
  input ObjectInput {
    _id: ID!
    bbox: [Float!]
    locked: Boolean!
    labels: [CreateLabelInput]
  }

  input CreateObjectInput {
    imageId: ID!
    object: ObjectInput!
  }

  input CreateObjectsInput {
    objects: [CreateObjectInput!]!
  }
`;
