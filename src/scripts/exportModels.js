import fs from 'node:fs';
import path from 'node:path';
import appRoot from 'app-root-path';
import { DateTime } from 'luxon';
import MLModel from '../../.build/api/db/schemas/MLModel.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import { backupConfig } from './backupConfig.js';

async function exportModels() {
  console.log('Fetching remote config...');
  const config = await getConfig();
  const stage = process.env.STAGE || 'dev';

  console.log(`Connecting to ${stage} database...`);
  await connectToDatabase(config);

  console.log('Fetching ML models...');
  const models = await MLModel.find({});

  // Flatten: one row per category
  const rows = [];
  for (const model of models) {
    for (const cat of model.categories) {
      rows.push({
        'Model ID': model._id,
        'Model Description': model.description || '',
        'Model Version': model.version,
        'Category ID': cat._id,
        'Category Name': cat.name,
        'Category Color': cat.color,
        'Category Taxonomy': cat.taxonomy || '',
      });
    }
  }

  // Build CSV
  const headers = [
    'Model ID',
    'Model Description',
    'Model Version',
    'Category ID',
    'Category Name',
    'Category Color',
    'Category Taxonomy',
  ];
  const csvHeader = headers.join(',');
  const csvRows = rows.map((row) =>
    headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(','),
  );
  const csvContent = [csvHeader, ...csvRows].join('\n');

  // Write to backups directory
  const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
  const outDir = path.join(appRoot.path, backupConfig.BACKUP_DIR);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const csvPath = path.join(outDir, `animl-${stage}--mlmodels--${dt}.csv`);
  fs.writeFileSync(csvPath, csvContent, 'utf8');

  console.log(`Exported ${rows.length} category rows from ${models.length} models`);
  console.log(`CSV written to: ${csvPath}`);
  process.exit(0);
}

exportModels().catch((err) => {
  console.error(err);
  process.exit(1);
});
