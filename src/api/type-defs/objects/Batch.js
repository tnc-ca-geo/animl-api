module.exports = `
  type Batch {
    _id: String!
    eTag: String!
    processingStart: String!
    processingEnd: String
    remaining: Int
    dead: Int
    total: Int
  }
`;
