import { MongoClient } from "mongodb";

const uri = process.env.DB_CONNECTION_STRING;
const dbName = process.env.DB_NAME;
const dbCollection = process.env.DB_COLLECTION;

if (!uri || !dbName || !dbCollection) {
  console.error("Missing required env variables: DB_CONNECTION_STRING, DB_NAME, DB_COLLECTION");
  process.exit(1);
}

const client = new MongoClient(uri);

async function createIndex() {
  try {
    const database = client.db(dbName);
    const collection = database.collection(dbCollection);

    const index = {
      name: "comments",
      definition: {
        "mappings": {
          "dynamic": false,
          "fields": {
            "comments": {
              "type": "embeddedDocuments",
              "dynamic": false,
              "fields": {
                "comment": {
                  "type": "string"
                }
              }
            }
          }
        }
      }
    }

    const result = await collection.createSearchIndex(index);
    console.log(`Successfully created index: ${result}`);
  } catch (err) {
    console.error(`Encountered an error when creating index: ${err}`);
  } finally {
    await client.close();
    process.exit(0);
  }
}

createIndex();
