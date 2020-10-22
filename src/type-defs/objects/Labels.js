module.exports = `
  type Validation {
    reviewed: Boolean!
    validated: Boolean!
    reviewDate: Date!
  }

  type Labels {
    type: String!
    category: String!
    conf: Float
    bbox: [Int!]
    labeledDate: Date!
    validation: Validation!
  }
`;

  // TODO: add to Label:
  // model: { type: Schema.Types.ObjectId, ref: 'Model' }

  // TODO: add to Validation: 
  // user: { type: Schema.Types.ObjectId, ref: 'User' },
