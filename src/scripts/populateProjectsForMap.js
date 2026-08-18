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
  'Stage',
  'Latitude',
  'Longitude',
  'Label',
];

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

  const stage = process.env.STAGE || 'dev';
  if (stage !== 'prod') {
    console.warn(`WARNING: STAGE is "${stage}", not "prod". Connecting to the ${stage} database.`);
  }

  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {
    // Parse input CSV
    const csvText = fs.readFileSync(resolvedInputPath, 'utf8');
    const inputRows = parse(csvText, { columns: true, skip_empty_lines: true });

    // Fetch all external projects from DB
    const dbProjects = await Project.find({ type: { $ne: 'internal' } }).lean();
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

      const currentStage = row['Stage'];
      const dbStage = dbProject.stage ?? '';

      if (currentStage !== dbStage) {
        console.log(
          `  Updating stage for "${row['Name']}" (${projectId}): "${currentStage}" → "${dbStage}"`,
        );
        updated++;
        outputRows.push({ ...row, Stage: dbStage });
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

      const coords = dbProject.location?.geometry?.coordinates;
      const longitude = coords ? coords[0] : '';
      const latitude = coords ? coords[1] : '';

      maxObjectId++;
      added++;
      console.log(`  Adding: "${dbProject.name}" (${dbProject._id})`);

      outputRows.push({
        'OBJECTID *': maxObjectId,
        'Shape *': 'Point',
        ProjectId: dbProject._id,
        Name: dbProject.name,
        Stage: dbProject.stage ?? '',
        Latitude: latitude,
        Longitude: longitude,
        Label: dbProject.name,
      });
    }

    // Write output CSV
    const date = DateTime.now().setZone('utc').toFormat('yyyy-LL-dd');
    const backupsRoot = path.join(appRoot.path, backupConfig.BACKUP_DIR);
    const outputFileName = `Animl-projects-for-map-${date}.csv`;
    const outputPath = path.join(backupsRoot, outputFileName);

    const csvOutput = stringify(outputRows, { header: true, columns: COLUMNS });
    fs.writeFileSync(outputPath, csvOutput, 'utf8');

    console.log(`\nDone.`);
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
