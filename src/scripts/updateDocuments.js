const { ApolloError } = require('apollo-server-errors');
const { getConfig } = require('../config/config');
const { connectToDatabase } = require('../api/db/connect');
const Image = require('../api/db/schemas/Image');


async function updateDocuments() {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {

    // TODO: create backup of db with mongodump
    // probably will need to create a child process to execute this:
    // https://docs.atlas.mongodb.com/command-line-tools/

    // count images w/ objects that have empty label arrays
    const query = { 'objects.labels': { $size: 0 } };
    const count = await Image.where(query).countDocuments();
    console.log('number of images w/ accidental objects: ', count);

    // TODO: use updateMany & pull to update the documents
    // https://mongoosejs.com/docs/api.html#model_Model.updateMany
    // https://docs.mongodb.com/manual/reference/operator/update/pull/#std-label-pull-array-of-documents

    // Image.updateMany(
    //   { },
    //   { $pull: { 'objects.labels': { $size: 0 } } }
    // );
  
    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('An error occured while updating the documents: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
};

updateDocuments();
