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
const { getUserInfo } = require('./auth/authorization');

const resolvers = {
  Query,
  Mutation,
  ...Fields,
  ...Scalars,
};

const context = async ({ event: req }) => {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  // Authorize user and pass into model generator functions
  // https://www.apollographql.com/docs/apollo-server/security/authentication/#authorization-in-resolvers
  const user = await getUserInfo(req, config);
    
  return {
    ...req,
    user,
    config,
    models: {
      View: generateViewModel({ user }),
      Image: generateImageModel({ user }),
      Camera: generateCameraModel({ user }),
      Model: generateModelModel({ user }),
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