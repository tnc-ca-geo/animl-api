module.exports = `
  type Query {
    hello(name: String): String!
    dummyQuery(itemId: ID!): DummyObject!
    todos: [Todo!]!
    todo(_id: ID!): Todo!
  }
`;
