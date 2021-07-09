module.exports = `
  type Validation {
    validated: Boolean!
    validationDate: Date!
    userId: ID!
  }

  type Label {
    _id: ID!
    type: String!
    category: String!
    conf: Float
    bbox: [Float!]!
    labeledDate: Date!
    validation: Validation
    modelId: ID
    userId: ID
  }

  type LabelList {
    categories: [String]
  }

  type Object {
    _id: ID!
    bbox: [Float!]
    locked: Boolean!
    labels: [Label]
  }
`;