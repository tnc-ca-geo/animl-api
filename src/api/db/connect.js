const mongoose = require('mongoose');
const { ApolloError } = require('apollo-server-errors');
// TODO: consider using multiple connections (one per model)
// to reduce risk of slow trains 
// https://mongoosejs.com/docs/connections.html#multiple_connections
// https://thecodebarbarian.com/slow-trains-in-mongodb-and-nodejs

let cachedConnectionPromise = null;

module.exports.connectToDatabase = async function connectToDb(config) {
  if (!cachedConnectionPromise) {
    // If no connection promise is cached, create a new one.
    // We cache the promise instead of the connection itself to prevent race 
    // conditions where connect is called more than once.
    const uri = config['/DB/MONGO_DB_URL'];
    cachedConnectionPromise = mongoose.connect(uri, {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      bufferCommands: false,
      bufferMaxEntries: 0,
      // TODO: double check auto indexing is off in prod environment
      ...((process.env.STAGE === 'prod') && { autoIndex: false }),
    });
  }

  try {
    const client = await cachedConnectionPromise;
    return client;
  } catch (err) {
    throw new ApolloError(err);
  }
};