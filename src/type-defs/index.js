const Date = require('./objects/Date');
const DummyInput = require('./inputs/DummyInput');
const DummyObject = require('./objects/DummyObject');
const Todo = require('./objects/Todo');
const TodoInput = require('./inputs/TodoInput');
const Image = require('./objects/Image');
const ImageInput = require('./inputs/ImageInput');
const CreateImagePayload = require('./payloads/CreateImagePayload');
const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this apporach with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  Date,
  DummyInput,
  DummyObject,
  Image,
  ImageInput,
  CreateImagePayload,
  Todo,
  TodoInput,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

console.log(typeDefs);

module.exports = typeDefs;
