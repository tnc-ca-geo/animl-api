module.exports = `
  type Batch {
    _id: String!
    processingStart: String!
    processingEnd: String
    remaining: Int
    total: Int
  }
`;
