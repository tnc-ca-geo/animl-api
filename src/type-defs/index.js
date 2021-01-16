const CreateImageInput = require('./inputs/CreateImageInput');
const CreateViewInput = require('./inputs/CreateViewInput');
const QueryImageInput = require('./inputs/QueryImageInput');

const Camera = require('./objects/Camera');
const Filters = require('./objects/Filters');
const Image = require('./objects/Image');
const Label = require('./objects/Label');
const Location = require('./objects/Location');
const PageInfo = require('./objects/PageInfo');
const Scalars = require('./objects/Scalars');
const View = require('./objects/View');

const CreateImagePayload = require('./payloads/CreateImagePayload');
const CreateViewPayload = require('./payloads/CreateViewPayload');
const ImageConnection = require('./payloads/ImageConnection');
const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this apporach with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  CreateImageInput,
  CreateViewInput,
  QueryImageInput,
  Camera,
  Filters,
  Image,
  Label,
  Location,
  PageInfo,
  Scalars,
  View,
  CreateImagePayload,
  CreateViewPayload,
  ImageConnection,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
