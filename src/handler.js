'use strict';
const mongoose = require('mongoose');
const { GraphQLServerLambda } = require('graphql-yoga');
const Query = require('./resolvers/Query/index');
const Mutation = require('./resolvers/Mutation/index');
const config = require('./config/config');
const typeDefs = require('./type-defs');

async function start() {
  const mongoClient = await mongoose.connect(
    config.MONGO_DB_URL,
    { useNewUrlParser: true, useUnifiedTopology: true }
  );
  mongoose.connection.on('error', function(err) {
    console.log('Mongoose default connection error: ' + err);
  });
  return true;
}

const resolvers = {
  Query,
  Mutation
};

const lambda = new GraphQLServerLambda({
  typeDefs,
  resolvers,
  context: req => ({ ...req })
});

// TODO: figure out how to get async / awake to work in the lambada functions. 
// it works fine as it is now but the following breaks it:
// exports.playground = await (event, context, callback) => {...}

exports.playground = (event, context, callback) => {
  // b/c we will have a constant connection to our database we also need 
  // to tell Lambda to not wait for our event loop to be empty before 
  // returning values to us
  context.callbackWaitsForEmptyEventLoop = false;
  // await start();
  return lambda.playgroundHandler(event, context, callback);
};
exports.server = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  // await start();
  return lambda.graphqlHandler(event, context, callback);
};