const DummyInput = require('./inputs/DummyInput');
const DummyObject = require('./objects/DummyObject');
const Todo = require('./objects/Todo');
const Mutation = require('./root/Mutation');
const Query = require('./root/Query');

const typeDefStrings = [
  DummyInput,
  DummyObject,
  Todo,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
