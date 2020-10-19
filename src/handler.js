const { GraphQLServerLambda } = require('graphql-yoga');
const mongoose = require('mongoose');
const generateImageModel = require('./db/models/Image');
const generateCameraModel = require('./db/models/Camera');
const Query = require('./resolvers/Query');
const Mutation = require('./resolvers/Mutation');
const Fields = require('./resolvers/Fields');
const Scalars = require('./resolvers/Scalars');
const config = require('./config/config');
const typeDefs = require('./type-defs');


let cachedDb = null;

async function connectToDb() {
  console.log('connecting to database...');
  if (cachedDb) {
    console.log('Using cached database instance');
    return cachedDb;
  }

  const options = {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // TODO: double check auto indexing is off in prod environment
    ...((process.env.STAGE === 'prod') && { autoIndex: false }),
  };
  const mongoClient = await mongoose.connect( config.MONGO_DB_URL, options);
  mongoose.connection.on('error', (err) => {
    console.log('Mongoose default connection error: ' + err);
  });
  console.log('successful connection');
  cachedDb = mongoClient;
  return cachedDb;
};

const resolvers = {
  Query,
  Mutation,
  ...Fields,
  ...Scalars,
};

console.log('resolvers: ', resolvers);

const context = ({ req }) => {
// TODO: authorize use and pass into model generator functions
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
  models: {
    // TODO: pass in user to image model generator once we implement user auth
    // Image: generateImageModel({ user }),
    Image: generateImageModel({ connectToDb }),
    Camera: generateCameraModel({ connectToDb }),
  }
 };

};

const lambda = new GraphQLServerLambda({
  typeDefs,
  resolvers,
  context: context,
});


exports.playground = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.playgroundHandler(event, context, callback);
};
exports.server = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  lambda.graphqlHandler(event, context, callback);
};