import { ApolloServer, BaseContext } from '@apollo/server';
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
import typeDefs from './type-defs/index.js';
import { Config, getConfig } from '../config/config.js';
import { connectToDatabase } from './db/connect.js';
import { User, getUserInfo } from './auth/authorization.js';
import { APIGatewayEvent } from 'aws-lambda';
import { GraphQLFormattedError } from 'graphql';
import { AuthenticationError } from './errors.js';

const resolvers = {
  Query,
  Mutation,
  ...Scalars,
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
const OFFLINE_MODE = process.env.IS_OFFLINE === 'true';

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

interface ContextInput {
  event: APIGatewayEvent;
  context: BaseContext & { callbackWaitsForEmptyEventLoop?: boolean };
}

const apolloserver = new ApolloServer<BaseContext>({
  includeStacktraceInErrorResponses: OFFLINE_MODE || process.env.STAGE === 'dev',
  status400ForVariableCoercionErrors: true,
  typeDefs,
  resolvers,
  csrfPrevention: false,
  cache: 'bounded',
  introspection: OFFLINE_MODE,
  formatError: (error: GraphQLFormattedError) => {
    console.error(error);
    return error;
  },
});

export const server = startServerAndCreateLambdaHandler(
  apolloserver as any, // TODO: Getting strange error about type mismatch due to apolloserver being typed as ApolloServer<BaseContext>  instead of ApolloServer<any>
  handlers.createAPIGatewayProxyEventRequestHandler(),
  {
    middleware: [corsMiddleware],
    context,
  },
);

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
