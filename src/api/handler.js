import { ApolloServer } from 'apollo-server-lambda';
import { AuthenticationError } from 'apollo-server-errors';
import { formatError } from './errors.js';
import AuthedProjectModel from './db/models/Project.js';
import AuthedImageModel from './db/models/Image.js';
import AuthedCameraModel from './db/models/Camera.js';
import AuthedMLModelModel from './db/models/MLModel.js';
import AuthedBatchModel from './db/models/Batch.js';
import AuthedBatchErrorModel from './db/models/BatchError.js';
import AuthedImageErrorModel from './db/models/ImageError.js';
import Query from './resolvers/Query.js';
import Mutation from './resolvers/Mutation.js';
import Fields from './resolvers/Fields.js';
import Scalars from './resolvers/Scalars.js';
import typeDefs from './type-defs/index.js';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from './db/connect.js';
import { getUserInfo } from './auth/authorization.js';

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
  console.log('event: ', event.body);
  console.log('user: ', user);

  return {
    ...event,
    ...context,
    user,
    config,
    models: {
      Project: new AuthedProjectModel(user),
      Image: new AuthedImageModel(user),
      ImageError: new AuthedImageErrorModel(user),
      Camera: new AuthedCameraModel(user),
      MLModel: new AuthedMLModelModel(user),
      Batch: new AuthedBatchModel(user),
      BatchError: new AuthedBatchErrorModel(user)
    }
  };
};

const srv = new ApolloServer({
  includeStacktraceInErrorResponses: process.env.STAGE === 'dev',
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

const server = srv.createHandler();

export {
  server
};
