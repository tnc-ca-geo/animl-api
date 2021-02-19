module.exports = `
  type Validation {
    validated: Boolean!
    vaidationDate: Date!
  }

  type Label {
    type: String!
    category: String!
    conf: Float
    bbox: [Float!]
    labeledDate: Date!
    validation: Validation!
  }

  type LabelList {
    categories: [String]
  }
`;

  // TODO: add to Label:
  // user: { type: Schema.Types.ObjectId, ref: 'User' },
  // model: { type: Schema.Types.ObjectId, ref: 'Model' }

  // TODO: add to Validation: 
  // user: { type: Schema.Types.ObjectId, ref: 'User' },
