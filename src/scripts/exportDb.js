const fs = require('fs');
const path = require('path');
const util = require('util');
const execSync = util.promisify(require('child_process').execSync);
const appRoot = require('app-root-path');
const { DateTime } = require('luxon');
const { ApolloError } = require('apollo-server-errors');
const { connectToDatabase } = require('../api/db/connect');
const { getConfig } = require('../config/config');
const { backupConfig } = require('./backupConfig');

async function listCollections(config) {
    let db;
    try {
        db = await connectToDatabase(config);
        let collections = await db.connections[0].db.listCollections().toArray();
        collections = collections.map((col) => col.name);
        db.connection.close();
        return collections;
    } catch (err) {
        db.connection.close();
        throw new ApolloError(err);
    }
}

async function backupCollection(collection, options) {
    try {
        console.log(`\nBacking up ${options.db} -- ${collection}...`);
        const out = `${options.outputPath}/${options.db}--${collection}.json`;
        const cmd = `mongoexport \
      --uri ${options.dbUri} \
      --collection ${collection} \
      --type json \
      --out ${out}
    `;
        const { stdout, stderr } = await execSync(cmd);
        console.log('stdout: ', stdout);
        console.log('stderr: ', stderr);
    } catch (err) {
        throw new ApolloError(err);
    }
}

async function exportDb() {
    console.log('Fetching remote config...');
    const config = await getConfig();
    const stage = process.env.STAGE || 'dev';
    const db = `animl-${stage}`;
    const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
    const backupsRoot = path.join(appRoot.path, backupConfig.BACKUP_DIR);
    const snapshotPath = path.join(backupsRoot, db, dt);

    if (!fs.existsSync(snapshotPath)) {
        fs.mkdirSync(snapshotPath, { recursive: true });
    }

    const options = {
        db,
        dbUri: config['/DB/MONGO_DB_URL'].split('?')[0],
        outputPath: snapshotPath
    };

    try {

        console.log(`backing up db: ${db}...`);
        const collections = await listCollections(config);
        if (!collections || collections.length === 0) {
            throw new ApolloError(`Failed to find collections for db ${db}`);
        }
        const colCount = collections.length;
        console.log(`${colCount} collections found: ${collections.join(', ')}`);

        for (const collection of collections) {
            backupCollection(collection, options);
        }

        // TODO: zip results

        // TODO: also create BSON backup w/ mongodump?
        // Not sure what the value would be of having BSON as well as JSON backups

        process.exit(0);
    } catch (err) {
        throw new ApolloError('An error occured while backing up the db: ', err);
    }
}

exportDb();
