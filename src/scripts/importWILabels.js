import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import fs from 'fs';
import { parse } from 'csv-parse';
import Image from '../api/db/schemas/Image.js';
import { ImageModel } from '../api/db/models/Image.js';

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

const WI_CSV = '/Users/nathaniel.rindlaub/Downloads/wildlife_insights_images.csv';
const USER_ID = 'zilz@ucsb.edu';

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

  let imagesInCSVCount = null;
  let imagesNotFound = [];
  let imagesUpdatedCount = 0;
  let imagesNoObjsCount = 0;
  let objectHasLabelCount = 0;
  let emptyObjectCount = 0;

  try {

    // read in Wildlife Insights CSV
    const data = await readCSV(WI_CSV);
    imagesInCSVCount = data.length;
    console.log(`Found ${data.length} image records in the CSV. Creating labels...`);

    for (const row of data) {
      const category = row.common_name || row.species || row.genus;

      // find corresponding Image in Animl for each image in the CSV
      const ofn = `${row.image_id}.jpg`;
      const image = await Image.findOne({ originalFileName: ofn });

      if (!image) {
        imagesNotFound.push(ofn);
        continue;
      }

      if (!image.objects) {
        imagesNoObjsCount++;
        continue;
      }

      // for each object in each image, create un-validated labels
      const newLabels = image.objects.reduce((lbls, obj) => {

        // skip objects that already have a label with this common name
        const hasThisLabel = obj.labels.find((lbl) => lbl.category === category);
        if (hasThisLabel) objectHasLabelCount++;

        // skip "empty" objects
        const isEmpty = obj.labels.find((lbl) => lbl.category === 'empty');
        if (isEmpty) emptyObjectCount++;

        if (!hasThisLabel && !isEmpty) {
          lbls.push({
            imageId: image._id,
            type: 'manual',
            userId: USER_ID,
            validation: null,
            bbox: obj.bbox,
            conf: 0.9,
            category: category.toLowerCase()
          });
        }

        return lbls;

      }, []);

      if (newLabels.length > 0) {
        const input = { labels: newLabels };
        const context =  { user: { 'is_superuser': true } };
        await ImageModel.createLabels(input, context);

        imagesUpdatedCount++;
      }
    }

  } catch (err) {

    console.log('An error occurred adding the Wildlife Insights data to the database: ', err);
    dbClient.connection.close();

  } finally {

    console.log(`${imagesUpdatedCount} images in Animl were successfully updated with new labels out of the ${imagesInCSVCount} found in CSV`);
    console.log(`${imagesNoObjsCount} images had empty object arrays in Animl, so were skipped`);
    console.log(`${objectHasLabelCount} objects already had the WI label, so were skipped`);
    console.log(`${emptyObjectCount} objects we're "empty" objects, so were skipped`);
    console.log('The following images could not be found in Animl: ', imagesNotFound);

    dbClient.connection.close();
    process.exit(0);

  }
}

importWILabels();
