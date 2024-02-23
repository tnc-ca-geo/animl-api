import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler, handlers } from '@as-integrations/aws-lambda';
import { formatError, AuthenticationError } from './errors.js';
import AuthedProjectModel from './db/models/Project.js';
import AuthedUserModel from './db/models/User.js';
import AuthedImageModel from './db/models/Image.js';
import AuthedCameraModel from './db/models/Camera.js';
import AuthedMLModelModel from './db/models/MLModel.js';
import AuthedBatchModel from './db/models/Batch.js';
import AuthedBatchErrorModel from './db/models/BatchError.js';
import AuthedImageErrorModel from './db/models/ImageError.js';
import Query from './resolvers/Query.js';
import Mutation from './resolvers/Mutation.js';
import Scalars from './resolvers/Scalars.js';
import typeDefs from './type-defs/index.js';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from './db/connect.js';
import { getUserInfo } from './auth/authorization.js';

const resolvers = {
  Query,
  Mutation,
  ...Scalars
};

const authMiddleware = async (resolve, parent, args, context, info) => {
  if (!context.user) throw new AuthenticationError('Authentication failed');
  return await resolve(parent, args, context, info);
};

const context = async ({ event, context }) => {
  console.log('event: ', event.body);
  context.callbackWaitsForEmptyEventLoop = false;
  const config = await getConfig();
  await connectToDatabase(config);
  console.log('connected to db');
  const user = await getUserInfo(event, config);
  console.log('user: ', user);

  return {
    ...event,
    ...context,
    user,
    config,
    models: {
      User: new AuthedUserModel(user),
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

const apolloserver = new ApolloServer({
  includeStacktraceInErrorResponses: process.env.STAGE === 'dev',
  status400ForVariableCoercionErrors: true,
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

export const server = startServerAndCreateLambdaHandler(
  apolloserver,
  handlers.createAPIGatewayProxyEventV2RequestHandler()
);
