/**
 * exportProjectsForMap.js
 *
 * Regenerates the "Projects for map" CSV (used to build the public map of
 * Animl projects) by reconciling an input CSV against the current state of
 * `external` Projects in the database.
 *
 * For each row in the input CSV whose ProjectId still exists in the DB, the
 * Name, Organization, Description, Stage, Created, Latitude, and Longitude
 * fields are overwritten with the current DB values. `Label` is a CSV-only
 * field (it does not exist in the DB) and is always passed through unchanged.
 * Rows whose ProjectId no longer exists in the DB are dropped, and any DB
 * projects not already present in the input CSV are appended as new rows
 * (with an empty `Label`).
 *
 * Usage (from the animl-api root, after building):
 *   npm run build
 *   aws-vault exec animl -- env STAGE=prod REGION=us-west-2 \
 *     node src/scripts/exportProjectsForMap.js <path-to-input-csv>
 *
 * Example:
 *   aws-vault exec animl -- env STAGE=prod REGION=us-west-2 \
 *     node src/scripts/exportProjectsForMap.js ./backups/Animl-projects-for-map.csv
 *
 * <path-to-input-csv> should be the CSV output from the previous run of this
 * script (or the initial seed CSV), and is resolved relative to the repo
 * root. The output is written to:
 *   backups/Animl-projects-for-map_DB-export_<yyyy-LL-dd>.csv
 * and should be used as the input CSV the next time this script is run.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import { backupConfig } from './backupConfig.js';
import Project from '../../.build/api/db/schemas/Project.js';

const COLUMNS = [
  'OBJECTID *',
  'Shape *',
  'ProjectId',
  'Name',
  'Organization',
  'Description',
  'Stage',
  'Created',
  'Latitude',
  'Longitude',
  'Label',
];

// Fields sourced from the DB record; Label is intentionally excluded (CSV-only field).
function dbFieldsForProject(dbProject) {
  const coords = dbProject.location?.geometry?.coordinates;
  return {
    Name: dbProject.name,
    Organization: dbProject.organization ?? '',
    Description: dbProject.description ?? '',
    Stage: dbProject.stage ?? '',
    Created: dbProject.created
      ? DateTime.fromJSDate(new Date(dbProject.created)).setZone('utc').toFormat('yyyy-LL-dd')
      : '',
    Latitude: coords ? coords[1] : '',
    Longitude: coords ? coords[0] : '',
  };
}

async function populateProjectsForMap() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node src/scripts/populateProjectsForMap.js <path-to-input-csv>');
    process.exit(1);
  }

  const resolvedInputPath = path.resolve(appRoot.path, inputPath);
  if (!fs.existsSync(resolvedInputPath)) {
    console.error(`Input file not found: ${resolvedInputPath}`);
    process.exit(1);
  }

  const stage = process.env.STAGE || 'prod';
  if (stage !== 'prod') {
    console.warn(`WARNING: STAGE is "${stage}", not "prod". Connecting to the ${stage} database.`);
  }

  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {
    // Parse input CSV
    const csvText = fs.readFileSync(resolvedInputPath, 'utf8');
    const inputRows = parse(csvText, { columns: true, skip_empty_lines: true });

    // Fetch all `type === "external"` projects from DB
    const dbProjects = await Project.find({ type: 'external' }).lean();
    const dbProjectMap = new Map(dbProjects.map((p) => [p._id, p]));

    const outputRows = [];
    const seenProjectIds = new Set();
    let updated = 0;
    let removed = 0;

    // Process existing CSV rows
    for (const row of inputRows) {
      const projectId = row['ProjectId'];
      const dbProject = dbProjectMap.get(projectId);

      if (!dbProject) {
        console.log(`  Removing: "${row['Name']}" (${projectId}) — not found in DB`);
        removed++;
        continue;
      }

      seenProjectIds.add(projectId);

      // ESRI exports empty strings as the literal text "<Null>"
      if (row['Label'] === '<Null>') {
        row['Label'] = '';
      }

      const dbFields = dbFieldsForProject(dbProject);
      const changedFields = Object.keys(dbFields).filter(
        (field) => String(row[field] ?? '') !== String(dbFields[field] ?? ''),
      );

      if (changedFields.length > 0) {
        for (const field of changedFields) {
          console.log(
            `  Updating ${field} for "${row['Name']}" (${projectId}): "${row[field]}" → "${dbFields[field]}"`,
          );
        }
        updated++;
        outputRows.push({ ...row, ...dbFields });
      } else {
        outputRows.push({ ...row });
      }
    }

    // Compute max OBJECTID for new rows
    let maxObjectId = inputRows.reduce((max, row) => {
      const id = parseInt(row['OBJECTID *'], 10);
      return isNaN(id) ? max : Math.max(max, id);
    }, 0);

    let added = 0;

    // Append new projects not in the input CSV
    for (const dbProject of dbProjects) {
      if (seenProjectIds.has(dbProject._id)) continue;

      maxObjectId++;
      added++;
      console.log(`  Adding: "${dbProject.name}" (${dbProject._id})`);

      outputRows.push({
        'OBJECTID *': maxObjectId,
        'Shape *': 'Point',
        ProjectId: dbProject._id,
        ...dbFieldsForProject(dbProject),
        Label: '',
      });
    }

    // Write output CSV
    const date = DateTime.now().setZone('utc').toFormat('yyyy-LL-dd');
    const backupsRoot = path.join(appRoot.path, backupConfig.BACKUP_DIR);
    const outputFileName = `Animl-projects-for-map_DB-export_${date}.csv`;
    const outputPath = path.join(backupsRoot, outputFileName);

    const csvOutput = stringify(outputRows, { header: true, columns: COLUMNS });
    fs.writeFileSync(outputPath, csvOutput, 'utf8');

    console.log('\nDone.');
    console.log(`  Updated: ${updated}`);
    console.log(`  Removed: ${removed}`);
    console.log(`  Added:   ${added}`);
    console.log(`  Total rows: ${outputRows.length}`);
    console.log(`\nOutput written to: ${outputPath}`);

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

populateProjectsForMap();
