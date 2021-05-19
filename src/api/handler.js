const { GraphQLServerLambda } = require('graphql-yoga');
const { formatError } = require('apollo-errors');
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

const options = {
  formatError
};

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

// // get the user token from the headers
//  const token = req.headers.authentication || '';
  
//  // try to retrieve a user with the token
//  const user = getUser(token);

//  // optionally block the user
//  // we could also check user roles/permissions here
//  if (!user) throw new AuthenticationError('you must be logged in to query this schema');  

 // add the user to the context
 return {
  ...req,
  // user,
  config,
  models: {
    // TODO: pass in user to image model generator once we implement user auth
    // Image: generateImageModel({ user }),
    View: generateViewModel(),
    Image: generateImageModel(),
    Camera: generateCameraModel(),
    Model: generateModelModel(),
  },
 };
};

const lambda = new GraphQLServerLambda({
  options,
  typeDefs,
  resolvers,
  context,
});

exports.playground = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.playgroundHandler(event, context, callback);
};
exports.server = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.graphqlHandler(event, context, callback);
};