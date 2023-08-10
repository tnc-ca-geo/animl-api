import mongoose from 'mongoose';
import  { ApolloError } from 'apollo-server-errors';

// TODO: consider using multiple connections (one per model)
// to reduce risk of slow trains
// https://mongoosejs.com/docs/connections.html#multiple_connections
// https://thecodebarbarian.com/slow-trains-in-mongodb-and-nodejs

let cachedConnectionPromise = null;

async function connectToDatabase(config) {
  if (!cachedConnectionPromise) {
    // If no connection promise is cached, create a new one.
    // We cache the promise instead of the connection itself to prevent race
    // conditions where connect is called more than once.
    const uri = config['/DB/MONGO_DB_URL'];
    cachedConnectionPromise = await mongoose.connect(uri, {
      bufferCommands: false,
      // TODO: double check auto indexing is off in prod environment
      autoIndex: process.env.STAGE !== 'prod'
    });
  }

  try {
    const client = await cachedConnectionPromise;
    return client;
  } catch (err) {
    throw new ApolloError(err);
  }
}

export {
  connectToDatabase
};
