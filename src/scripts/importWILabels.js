import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';

/*
 * Script for importing label data from Wildlife Insights' exported CSVs.
 *
 * Assumes that users have already uploaded the image files to Animl
 * and that MegaDetector has predicted objects/bounding boxes on them
 *
 * This script iterates over the WI CSV and creates labels in Animl for each
 * detected object using the common_names found from WI. It treats those labels
 * as unvalidated so that users can go through and confirm that the labels match
 * each object.
 */

async function importWILabels() {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);
  console.log('Importing WI labels with config: ', config);

  try {

    // TODO: read in Wildlife Insights CSV

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
