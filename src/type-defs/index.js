const Scalars = require('./objects/Scalars');
const DummyInput = require('./inputs/DummyInput');
const DummyObject = require('./objects/DummyObject');
const Todo = require('./objects/Todo');
const TodoInput = require('./inputs/TodoInput');
const Image = require('./objects/Image');
const ImageInput = require('./inputs/ImageInput');
const Camera = require('./objects/Camera');
const Location = require('./objects/Location');
const CreateImagePayload = require('./payloads/CreateImagePayload');
const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this apporach with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  Scalars,
  DummyInput,
  DummyObject,
  Image,
  ImageInput,
  CreateImagePayload,
  Todo,
  TodoInput,
  Camera,
  Location,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
