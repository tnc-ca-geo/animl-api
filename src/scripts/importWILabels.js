import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import fs from 'fs';
import { parse } from 'csv-parse';

/*
 * Script for importing label data from Wildlife Insights' exported CSVs.
 *
 * Assumes that users have already uploaded the image files to Animl
 * and that MegaDetector has predicted objects/bounding boxes on them
 *
 * This script iterates over the WI CSV and creates labels in Animl for each
 * detected object using the common_names found from WI. It treats those labels
 * as un-validated so that users can go through and confirm that the labels match
 * each object.
 */

const WI_CSV = '/Users/nathaniel.rindlaub/Downloads/wi_test_data.csv';

function readCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const data = [];
    fs.createReadStream(csvPath)
      .pipe(parse({ delimiter: ',', columns: true }))
      .on('data', (row) => {
        data.push(row);
      })
      .on('end', () => {
        console.log('finished');
        resolve(data);
      })
      .on('error', (error) => {
        console.log(error.message);
        reject();
      });
  });
}

async function importWILabels() {
  const config = await getConfig();
  console.log('Importing WI labels with config: ', config);

  const dbClient = await connectToDatabase(config);
  console.log('Successfully connected to db: ', config);

  try {

    // read in Wildlife Insights CSV
    const data = await readCSV(WI_CSV);

    // TODO: find corresponding Image in Animl for each image in the CSV

    // TODO: create un-validated labels for each of the objects in those images

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('An error occurred adding the Wildlife Insights data to the database: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
}

importWILabels();
