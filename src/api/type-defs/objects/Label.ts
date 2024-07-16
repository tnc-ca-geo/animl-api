export default /* GraphQL */ `
  type Validation {
    validated: Boolean!
    validationDate: Date!
    userId: ID
  }

  type Label {
    _id: ID!
    type: String!
    labelId: String!
    conf: Float
    bbox: [Float!]!
    labeledDate: Date!
    validation: Validation
    mlModel: String
    mlModelVersion: String
    userId: ID
  }

  type LabelList {
    categories: [String!]
  }

  type Object {
    _id: ID!
    bbox: [Float!]
    locked: Boolean!
    labels: [Label!]
  }
`;
