async function connectDb(cachedDb) {
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

modules.export = {
  connectDb,
}