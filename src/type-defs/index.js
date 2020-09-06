const DummyInput = require('./inputs/DummyInput');
const DummyObject = require('./objects/DummyObject');
const Todo = require('./objects/Todo');
const TodoInput = require('./inputs/TodoInput');
const Mutation = require('./root/Mutation');
const Query = require('./root/Query');

const typeDefStrings = [
  DummyInput,
  DummyObject,
  Todo,
  TodoInput,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
