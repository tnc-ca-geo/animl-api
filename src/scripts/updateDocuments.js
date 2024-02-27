import fs from 'node:fs';
import path from 'node:path';
import { ApolloError } from 'apollo-server-errors';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import prompt from 'prompt';
import { connectToDatabase } from '../api/db/connect.js';
import { getConfig } from '../config/config.js';
import { backupConfig } from './backupConfig.js';
import { operations } from './operations.js';

const property = {
  name: 'confirmation',
  message: 'WARNING: are you sure you\'d like to perform this update?',
  validator: /y[es]*|n[o]?/,
  warning: 'Must respond yes or no',
  default: 'no'
};

async function createLogFile(collecton, _ids, operation) {
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
      modification: operation,
      _ids
    });
    await fs.writeFileSync(fileName, data, 'utf8');
  } catch (err) {
    throw new ApolloError(err);
  }
}

async function updateDocuments() {
  // TODO: accept op as param
  const op = 'COPY-OPERATION-NAME-HERE';
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
      const res = await operations[op].update();
      console.log('res: ', res);
      if (res.nModified === matchCount) {
        await createLogFile('images', matchingImageIds, op);
      }
      else {
        const msg = `There was a discrepancy between the number of matching
          documents and the number of modified documents`;
        throw new ApolloError(msg);
      }
    }

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    throw new ApolloError('An error occurred while updating documents: ', err);
  }
}

updateDocuments();
