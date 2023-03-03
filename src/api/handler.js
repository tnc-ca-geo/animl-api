const { ApolloServer } = require('apollo-server-lambda');
const { AuthenticationError } = require('apollo-server-errors');
const { formatError } = require('./errors');
const generateProjectModel = require('./db/models/Project');
const generateImageModel = require('./db/models/Image');
const generateCameraModel = require('./db/models/Camera');
const generateMLModelModel = require('./db/models/MLModel');
const generateBatchModel = require('./db/models/Batch');
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

const context = async ({ event, context }) => {
  context.callbackWaitsForEmptyEventLoop = false;
  const config = await getConfig();
  await connectToDatabase(config);
  const user = await getUserInfo(event, config);
  console.log('event: ', event);
  console.log('user: ', user);

  return {
    ...event,
    ...context,
    user,
    config,
    models: {
      Project: generateProjectModel({ user }),
      Image: generateImageModel({ user }),
      Camera: generateCameraModel({ user }),
      MLModel: generateMLModelModel({ user }),
      Batch: generateBatchModel({ user })
    }
  };
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context,
  csrfPrevention: true,
  cache: 'bounded',
  middlewares: [authMiddleware],
  options: {
    formatError
  }
});

exports.server = server.createHandler();
