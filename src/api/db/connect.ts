import mongoose from "mongoose";
import { InternalServerError } from "../errors.js";

// TODO: consider using multiple connections (one per model)
// to reduce risk of slow trains
// https://mongoosejs.com/docs/connections.html#multiple_connections
// https://thecodebarbarian.com/slow-trains-in-mongodb-and-nodejs

let client: typeof mongoose | null = null;

async function connectToDatabase(config: any) {
  // TODO: type config
  if (!client) {
    // If no connection promise is cached, create a new one.
    // We cache the promise instead of the connection itself to prevent race
    // conditions where connect is called more than once.
    const uri = config["/DB/MONGO_DB_URL"];
    client = await mongoose.connect(uri, {
      bufferCommands: false,
      // TODO: double check auto indexing is off in prod environment
      autoIndex: process.env.STAGE !== "prod",
    });
  }

  try {
    return client;
  } catch (err) {
    throw new InternalServerError(
      err instanceof Error ? err.message : String(err)
    );
  }
}

export { connectToDatabase };
