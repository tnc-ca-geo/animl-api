const mongoose = require('mongoose');

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
    cachedConnectionPromise = mongoose.connect(config.MONGO_DB_URL, {
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
    console.log('error connecting to database: ', err);
    throw new Error(err);
  }
};