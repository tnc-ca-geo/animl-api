const fs = require('fs');
const path = require('path');
var appRoot = require('app-root-path');
const util = require('util');
const execSync = util.promisify(require('child_process').execSync);
const { getConfig } = require('../config/config');
const { backupConfig } = require('./backupConfig');
const { options } = require('superagent');

async function backupCollection(collection, options) {
  try {
    console.log(`backing up ${collection}`);
    const out = `${options.backupPath}/animl-${options.stage}-${collection}.json`
    const cmd = `mongoexport \
      --uri ${options.dbUri} \
      --collection ${collection} \
      --type json \
      --out ${out}
    `
    const { stdout, stderr } = await execSync(cmd);
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
  } catch (e) {
    console.error(e);
  }
}

async function exportDb() {
  // get config
  console.log('Fetching remote config...');
  const config = await getConfig();
  const options = {
    stage: process.env.STAGE || 'dev',
    dbUri: config['/DB/MONGO_DB_URL'].split('?')[0],
    backupPath: path.join(appRoot.path, backupConfig.BACKUP_DIR),
  };
  console.log('options: ', options)
  
  // create backup directory
  if (!fs.existsSync(options.backupPath)) {
    console.log('Backup directory does not exist, creating it...');
    fs.mkdirSync(options.backupPath);
  }
  
  try {
    console.log('Backing up the following collections: ')
    for (const collection of backupConfig.COLLECTIONS) {
      backupCollection(collection, options);
    }
    
    // TODO: also create binary backup w/ mongodump?

    process.exit(0);
  } catch (err) {
    console.log('An error occured while backing up the db: ', err);
    process.exit(1);
  }
};

exportDb();
