const { GraphQLServerLambda } = require('graphql-yoga');
const { formatError } = require('./errors');
const generateViewModel = require('./db/models/View');
const generateImageModel = require('./db/models/Image');
const generateCameraModel = require('./db/models/Camera');
const generateModelModel = require('./db/models/Model');
const Query = require('./resolvers/Query');
const Mutation = require('./resolvers/Mutation');
const Fields = require('./resolvers/Fields');
const Scalars = require('./resolvers/Scalars');
const typeDefs = require('./type-defs');
const { getConfig } = require('../config/config');
const { connectToDatabase } = require('./db/connect');

const resolvers = {
  Query,
  Mutation,
  ...Fields,
  ...Scalars,
};

const context = async ({ req }) => {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

// TODO: authorize user and pass into model generator functions
// https://www.apollographql.com/docs/apollo-server/security/authentication/#authorization-in-resolvers

 return {
  ...req,
  config,
  models: {
    View: generateViewModel(),
    Image: generateImageModel(),
    Camera: generateCameraModel(),
    Model: generateModelModel(),
  },
 };
};

const lambda = new GraphQLServerLambda({
  typeDefs,
  resolvers,
  context,
  options: { 
    formatError,
  },
});

exports.playground = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.playgroundHandler(event, context, callback);
};
exports.server = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.graphqlHandler(event, context, callback);
};