module.exports = `
  type Validation {
    reviewed: Boolean!
    validated: Boolean!
    reviewDate: Date!
  }

  type Label {
    type: String!
    category: String!
    conf: Float
    bbox: [Int!]
    labeledDate: Date!
    validation: Validation!
  }

  type LabelList {
    categories: [String]
  }
`;

  // TODO: add to Label:
  // model: { type: Schema.Types.ObjectId, ref: 'Model' }

  // TODO: add to Validation: 
  // user: { type: Schema.Types.ObjectId, ref: 'User' },
