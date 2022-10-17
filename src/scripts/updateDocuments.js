const fs = require('fs');
const path = require('path');
const { ApolloError } = require('apollo-server-errors');
const { DateTime } = require('luxon');
const appRoot = require('app-root-path');
const prompt = require('prompt');
const { connectToDatabase } = require('../api/db/connect');
const { getConfig } = require('../config/config');
const { backupConfig } = require('./backupConfig');
const { operations } = require('./operations');

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
  // TODO: accept op as param
  const op = 'update-labels-to-new-schema';
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {

    // TODO: create backup of db with exportDb.js
    console.log(`Executing ${op}...`);
    const matchingImageIds = await operations[op].getIds();
    const matchCount = matchingImageIds.length;
    console.log(`This operation will affect ${matchCount} documents`);
    console.log('With Ids: ', matchingImageIds);
    if (matchCount === 0) {
      dbClient.connection.close();
      process.exit(0);
    }

    prompt.start();
    const { confirmation } = await prompt.get(property);
    if (confirmation === 'yes' || confirmation === 'y') {
      const res = await await operations[op].update();
      console.log('res: ', res);
      if (res.nModified === matchCount) {
        await createLogFile('images', matchingImageIds);
      }
      else {
        const msg = `There was a discrepency between the number of matching 
          documents and the number of modified documents`;
        throw new ApolloError(msg);
      }
    }

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    throw new ApolloError('An error occured while updating documents: ', err);
  }
}

updateDocuments();
