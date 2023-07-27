import { Export } from './export.js';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { ApolloError } from 'apollo-server-lambda';

async function handler(event) {
  if (!event.Records || !event.Records.length) return;
  const config = await getConfig();
  await connectToDatabase(config);

  for (const record of event.Records) {
    console.log(`record body: ${record.body}`);
    const params = JSON.parse(record.body);
    const dataExport = new Export(params, config);
    await dataExport.init();

    try {
      if (params.format === 'csv') {
        await dataExport.toCSV();
      } else if (params.format === 'coco') {
        await dataExport.toCOCO();
      } else {
        throw new ApolloError(`unsupported export format (${params.format})`);
      }
      await dataExport.success();
    } catch (err) {
      console.log('error exporting data: ', err);
      // update status document in S3 with error
      await dataExport.error(err);
      process.exit(1);
    }
  }

  return true;
}

export {
  handler
};
