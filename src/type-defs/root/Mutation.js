module.exports = `
  type Mutation {
    dummyMutation(input: DummyInput!): Boolean!
    createTodo(input: TodoInput!): Todo!
  }
`;
