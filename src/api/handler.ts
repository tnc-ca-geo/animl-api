import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler, handlers } from '@as-integrations/aws-lambda';
import AuthedProjectModel from './db/models/Project.js';
import AuthedUserModel from './db/models/User.js';
import AuthedImageModel from './db/models/Image.js';
import AuthedCameraModel from './db/models/Camera.js';
import AuthedMLModelModel from './db/models/MLModel.js';
import AuthedBatchModel from './db/models/Batch.js';
import AuthedBatchErrorModel from './db/models/BatchError.js';
import AuthedImageErrorModel from './db/models/ImageError.js';
import AuthedTaskModel from './db/models/Task.js';
import Query from './resolvers/Query.js';
import Mutation from './resolvers/Mutation.js';
import Scalars from './resolvers/Scalars.js';
import Fields from './resolvers/Fields.js';
import typeDefs from './type-defs/index.js';
import { Config, getConfig } from '../config/config.js';
import { connectToDatabase } from './db/connect.js';
import { User, getUserInfo } from './auth/authorization.js';
import { APIGatewayEvent } from 'aws-lambda';
import { AuthenticationError } from './errors.js';

const resolvers = {
  Query,
  Mutation,
  ...Scalars,
  ...Fields,
};

const corsMiddleware = async () => {
  return (result: any) => {
    result.headers = {
      ...result.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
    };

    return Promise.resolve();
  };
};

// Context comes from API Gateway event
const context = async ({ event, context }: ContextInput): Promise<Context> => {
  console.log('event: ', event.body);
  context.callbackWaitsForEmptyEventLoop = false;
  const config = await getConfig();
  await connectToDatabase(config);
  console.log('connected to db');
  const user = await getUserInfo(event, config);
  console.log('user: ', user);
  if (!user) throw new AuthenticationError('Authentication failed');

  return {
    ...event,
    ...context,
    user,
    config,
    models: {
      User: new AuthedUserModel(user),
      Task: new AuthedTaskModel(user),
      Project: new AuthedProjectModel(user),
      Image: new AuthedImageModel(user),
      ImageError: new AuthedImageErrorModel(user),
      Camera: new AuthedCameraModel(user),
      MLModel: new AuthedMLModelModel(user),
      Batch: new AuthedBatchModel(user),
      BatchError: new AuthedBatchErrorModel(user),
    },
  };
};

const apolloserver = new ApolloServer({
  includeStacktraceInErrorResponses: process.env.STAGE === 'dev',
  status400ForVariableCoercionErrors: true,
  typeDefs,
  resolvers,
  csrfPrevention: true,
  cache: 'bounded',
});

export const server = startServerAndCreateLambdaHandler(
  apolloserver as any, // NOTE: Getting strange error about type mismatch
  handlers.createAPIGatewayProxyEventRequestHandler(),
  {
    middleware: [corsMiddleware],
    context,
  },
);

interface ContextInput {
  event: APIGatewayEvent;
  context: { callbackWaitsForEmptyEventLoop?: boolean };
}

export interface Context extends APIGatewayEvent {
  models: {
    Batch: AuthedBatchModel;
    BatchError: AuthedBatchErrorModel;
    Camera: AuthedCameraModel;
    Image: AuthedImageModel;
    ImageError: AuthedImageErrorModel;
    MLModel: AuthedMLModelModel;
    Project: AuthedProjectModel;
    Task: AuthedTaskModel;
    User: AuthedUserModel;
  };
  config: Config;
  user: User;
}
