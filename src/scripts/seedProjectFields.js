/**
 * seedProjectFields.js
 *
 * One-off script to seed existing Project documents with new metadata fields
 * (type, stage, organization, location, country, state_province) from a CSV.
 *
 * Usage:
 *   npm run seed-project-fields-dev
 *   npm run seed-project-fields-prod
 *
 * Or with a custom CSV path:
 *   STAGE=dev CSV_PATH=/path/to/file.csv npm run seed-project-fields
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import Mongoose from 'mongoose';
import prompt from 'prompt';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import { InternalServerError } from '../../.build/api/errors.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import Project from '../../.build/api/db/schemas/Project.js';
import { backupConfig } from './backupConfig.js';

const DEFAULT_CSV_PATH = path.join(os.homedir(), 'Downloads', 'animl-project-new-fields.csv');

const property = {
  name: 'confirmation',
  message: "WARNING: are you sure you'd like to perform this update?",
  validator: /y[es]*|n[o]?/,
  warning: 'Must respond yes or no',
  default: 'no',
};

/**
 * Write a modification log file to backups/modification-log/
 */
async function createLogFile(ids, operation) {
  const stage = process.env.STAGE || 'dev';
  const db = `animl-${stage}`;
  const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
  const backupsRoot = path.join(appRoot.path, backupConfig.BACKUP_DIR);
  const logPath = path.join(backupsRoot, 'modification-log');
  const fileName = path.join(logPath, `${db}--projects--seed-fields--${dt}.json`);

  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true });
  }

  try {
    const data = JSON.stringify({ date: dt, db, modification: operation, _ids: ids }, null, 2);
    fs.writeFileSync(fileName, data, 'utf8');
    console.log(`Modification log written to ${fileName}`);
  } catch (err) {
    throw new InternalServerError(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Build a LocationSchema-compatible subdocument from lat/lng strings.
 * Returns null if either value is missing or not a valid number.
 */
function buildLocation(latStr, lngStr) {
  if (!latStr || !lngStr) return null;
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    _id: new Mongoose.Types.ObjectId(),
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
  };
}

/**
 * Build a $set object from a CSV row, including only non-empty fields.
 */
function buildSetFromRow(row) {
  const $set = {};

  if (row.type) $set.type = row.type;
  if (row.stage) $set.stage = row.stage;
  if (row.organization) $set.organization = row.organization;
  if (row.country) $set.country = row.country;
  // CSV column is "state_provence" (typo) — maps to schema field "state_province"
  if (row.state_provence) $set.state_province = row.state_provence;

  const location = buildLocation(row.latitude, row.longitude);
  if (location) $set.location = location;

  return $set;
}

async function seedProjectFields() {
  const csvPath = process.env.CSV_PATH || DEFAULT_CSV_PATH;
  console.log(`\nReading CSV from: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  // Parse CSV
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV\n`);

  // Build bulk operations
  const operations = [];
  const skippedNoId = [];
  const skippedEmpty = [];

  for (const row of rows) {
    const id = row._id;
    if (!id) {
      skippedNoId.push(row);
      continue;
    }

    const $set = buildSetFromRow(row);
    if (Object.keys($set).length === 0) {
      skippedEmpty.push(id);
      continue;
    }

    operations.push({
      updateOne: {
        filter: { _id: id },
        update: { $set },
        upsert: false,
      },
    });
  }

  // Validate IDs exist in DB
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {
    const csvIds = operations.map((op) => op.updateOne.filter._id);
    const existingProjects = await Project.find({ _id: { $in: csvIds } }).select('_id').lean();
    const existingIds = new Set(existingProjects.map((p) => p._id));

    const missingIds = csvIds.filter((id) => !existingIds.has(id));
    const matchedOps = operations.filter((op) => existingIds.has(op.updateOne.filter._id));

    // Summary
    console.log('=== Summary ===');
    console.log(`  CSV rows:              ${rows.length}`);
    console.log(`  Operations to apply:   ${matchedOps.length}`);
    if (skippedNoId.length > 0) {
      console.log(`  Skipped (no _id):      ${skippedNoId.length}`);
    }
    if (skippedEmpty.length > 0) {
      console.log(`  Skipped (no fields):   ${skippedEmpty.length} — ${skippedEmpty.join(', ')}`);
    }
    if (missingIds.length > 0) {
      console.log(`  Not found in DB:       ${missingIds.length}`);
      for (const id of missingIds) {
        console.log(`    ⚠  ${id}`);
      }
    }
    console.log('');

    if (matchedOps.length === 0) {
      console.log('Nothing to update. Exiting.');
      dbClient.connection.close();
      process.exit(0);
    }

    // Show a sample of what will be written
    console.log('Sample update (first matched operation):');
    console.log(JSON.stringify(matchedOps[0], null, 2));
    console.log('');

    // Interactive confirmation
    prompt.start();
    const { confirmation } = await prompt.get(property);
    if (confirmation !== 'yes' && confirmation !== 'y') {
      console.log('Aborted.');
      dbClient.connection.close();
      process.exit(0);
    }

    // Execute bulk write
    console.log('\nExecuting bulk write...');
    const result = await Project.bulkWrite(matchedOps);

    console.log(`  matchedCount:  ${result.matchedCount}`);
    console.log(`  modifiedCount: ${result.modifiedCount}`);

    // Log
    const modifiedIds = matchedOps.map((op) => op.updateOne.filter._id);
    await createLogFile(modifiedIds, 'seed-project-fields');

    console.log('\nDone!');
    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    dbClient.connection.close();
    process.exit(1);
  }
}

seedProjectFields();
