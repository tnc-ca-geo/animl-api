const { GraphQLServerLambda } = require('graphql-yoga');
const { AuthenticationError } = require('apollo-server-errors');
const { formatError } = require('./errors');
const generateProjectModel = require('./db/models/Project');
const generateImageModel = require('./db/models/Image');
const generateCameraModel = require('./db/models/Camera');
const generateMLModelModel = require('./db/models/MLModel');
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
  ...Scalars
};

const authMiddleware = async (resolve, parent, args, context, info) => {
  if (!context.user) throw new AuthenticationError('Authentication failed');
  return await resolve(parent, args, context, info);
};

const context = async ({ event: req }) => {
  const config = await getConfig();
  await connectToDatabase(config);
  const user = await getUserInfo(req, config);
  console.log('req: ', req);
  console.log('user: ', user);

  return {
    ...req,
    user,
    config,
    models: {
      Project: generateProjectModel({ user }),
      Image: generateImageModel({ user }),
      Camera: generateCameraModel({ user }),
      MLModel: generateMLModelModel({ user })
    }
  };
};

const lambda = new GraphQLServerLambda({
  typeDefs,
  resolvers,
  context,
  middlewares: [authMiddleware],
  options: {
    formatError
  }
});

exports.playground = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.playgroundHandler(event, context, callback);
};

exports.server = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.graphqlHandler(event, context, callback);
};
