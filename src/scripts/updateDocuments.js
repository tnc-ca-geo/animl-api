const fs = require('fs');
const path = require('path');
const { ApolloError } = require('apollo-server-errors');
const { DateTime } = require('luxon');
const appRoot = require('app-root-path');
const prompt = require('prompt');
const { connectToDatabase } = require('../api/db/connect');
const Image = require('../api/db/schemas/Image');
const { getConfig } = require('../config/config');
const { backupConfig } = require('./backupConfig');

const property = {
  name: 'confirmation',
  message: 'WARNING: are you sure you\'d like to perform this update?',
  validator: /y[es]*|n[o]?/,
  warning: 'Must respond yes or no',
  default: 'no'
};

async function createLogFile(collecton, _ids) {
  const stage = process.env.STAGE || 'dev';
  const db = `animl-${stage}`;
  const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
  const backupsRoot = path.join(appRoot.path, backupConfig.BACKUP_DIR);
  const logPath = path.join(backupsRoot, 'modification-log');
  const fileName = path.join(logPath, `/${db}--${collecton}--${dt}.json`);

  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
  }

  try {
    const data = JSON.stringify({
      date: dt,
      db: db,
      modification: 'Removed objects with empty labels arrays',
      _ids
    });
    await fs.writeFileSync(fileName, data, 'utf8');
  } catch (err) {
    throw new ApolloError(err);
  }
}

async function updateDocuments() {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {

    // TODO: create backup of db with exportDb.js

    // const query = { 'objects.labels': { $size: 0 } };
    const query = {};

    const matchingImageIds = await Image.find(query).select('_id');
    const matchCount = matchingImageIds.length
    console.log('number of images w/ accidental objects: ', matchCount);
    console.log('matchingImageIds: ', matchingImageIds);
    if (matchCount === 0) {
      dbClient.connection.close();
      process.exit(0);
    }

    prompt.start();
    const { confirmation } = await prompt.get(property);
    if (confirmation === 'yes' || confirmation === 'y') {

      // console.log('Removing objects with empty labels arrays...');
      // const res = await Image.updateMany(
      //   { },
      //   { $pull: { objects: { labels: { $size: 0} } } }
      // );

      console.log('Associating all images with sci_biosecurity project...');
      const res = await Image.updateMany({}, { project: 'sci_biosecurity' });
      console.log('res: ', res);
      await createLogFile('images', matchingImageIds);
    }

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    throw new ApolloError('An error occured while updating the documents: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
};

updateDocuments();
