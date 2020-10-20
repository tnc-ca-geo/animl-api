const CreateImageInput = require('./inputs/CreateImageInput');
const QueryImageInput = require('./inputs/QueryImageInput');

const Camera = require('./objects/Camera');
const Image = require('./objects/Image');
const Labels = require('./objects/Labels');
const Location = require('./objects/Location');
const PageInfo = require('./objects/PageInfo');
const Scalars = require('./objects/Scalars');

const CreateImagePayload = require('./payloads/CreateImagePayload');
const ImageConnection = require('./payloads/ImageConnection');
const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this apporach with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  CreateImageInput,
  QueryImageInput,
  Camera,
  Image,
  Labels,
  Location,
  PageInfo,
  Scalars,
  CreateImagePayload,
  ImageConnection,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
