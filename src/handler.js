const { GraphQLServerLambda } = require('graphql-yoga');
const mongoose = require('mongoose');
const Query = require('./resolvers/Query/index');
const Mutation = require('./resolvers/Mutation/index');
const config = require('./config/config');
const typeDefs = require('./type-defs');

// NOTE: I'm not entirely sure this is ever used b/c we're passing the 
// connectToDatabase() function into the context, and it only gets called 
// in the resolvers... do the resolvers have access to cachedDb variable?
let cachedDb = null;

async function connectToDatabase() {
  console.log('connecting to database...');
  if (cachedDb) {
    console.log('Using cached database instance');
    return cachedDb;
  }

  const options = { useNewUrlParser: true, useUnifiedTopology: true };
  const mongoClient = await mongoose.connect( config.MONGO_DB_URL, options);
  mongoose.connection.on('error', (err) => {
    console.log('Mongoose default connection error: ' + err);
  });
  console.log('successful connection');
  cachedDb = mongoClient;
  return cachedDb;
}

const resolvers = {
  Query,
  Mutation
};

const context = req => ({
  ...req,
  connectToDatabase,
});

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