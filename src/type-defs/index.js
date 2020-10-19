const ImageInput = require('./inputs/ImageInput');

const Camera = require('./objects/Camera');
const Image = require('./objects/Image');
const Labels = require('./objects/Labels');
const Location = require('./objects/Location');
const Scalars = require('./objects/Scalars');

const CreateImagePayload = require('./payloads/CreateImagePayload');
const ImageConnection = require('./payloads/ImageConnection');
const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this apporach with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  ImageInput,
  Camera,
  Image,
  Labels,
  Location,
  Scalars,
  CreateImagePayload,
  ImageConnection,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
