//Original code by Jesse Leung
//  Updated by CoPilot to read all predicted labels, crosswalk to human label, keep array for preserving duplicates
//  in order to report the count of each validation label.
//  This version maintains the original structure but allows for multiple instances of the same label


import { analysisConfig } from './analysisConfig.js';
import { getConfig } from '../../.build/config/config.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import Image from '../../.build/api/db/schemas/Image.js';

export const generateValidationList = async (analysisConfig, predictedLabels) => {
  const { PROJECT_ID, START_DATE, END_DATE, ML_MODEL } = analysisConfig;

  const validatingLabels = predictedLabels.reduce((acc, lbl) => {
    return { ...acc, [lbl]: [] };
  }, {});

  console.log('collecting images...');
  const images = await Image.aggregate([{
    $match: {
      projectId: PROJECT_ID,
      dateAdded: {
        $gte: new Date(START_DATE),
        $lte: new Date(END_DATE),
      },
      reviewed: true,
    },
  }]);

  console.log('building validation lists...');
  const validationLists = images.reduce((imgAcc, img) => {
    img.objects.forEach((obj) => {
      const mlLabel = obj.labels.find((lbl) => lbl.mlModel === ML_MODEL);
      if (!mlLabel) {
        return;
      }

      const validating = validatingLabels[mlLabel.labelId];

      if (!validating) {
        return;
      }

      const ids = obj.labels.reduce((acc, lbl) => {
        if (lbl.mlModel === 'megadetector') {
          return acc;
        }
        return acc.concat(lbl.labelId);
      }, []);

      // Use array to preserve duplicates for counting
      validatingLabels[mlLabel.labelId] = validating.concat(ids);
    });
    return imgAcc;
  }, validatingLabels);

  return validationLists;
};




// Example with timer and index check, ensuring DB connection is established first
const startTime = Date.now();
(async () => {
  try {
    const config = await getConfig();
    console.log('Connecting to db...');
    await connectToDatabase(config);


    // Automatically get all unique predicted labels from the database
    const allPredictedLabels = await Image.distinct('objects.labels.labelId', {
      projectId: analysisConfig.PROJECT_ID,
      dateAdded: {
        $gte: new Date(analysisConfig.START_DATE),
        $lte: new Date(analysisConfig.END_DATE),
      },
      reviewed: true
    });
    console.log('All unique predicted labels found:', allPredictedLabels);

  // Fetch the label crosswalk from the Project document
  const Project = (await import('../../.build/api/db/schemas/Project.js')).default;
  const projectDoc = await Project.findOne({ _id: analysisConfig.PROJECT_ID });
    const labelIdToName = {};
    if (projectDoc && Array.isArray(projectDoc.labels)) {
      for (const l of projectDoc.labels) {
        labelIdToName[l._id] = l.name;
      }
    }

    const result = await generateValidationList(analysisConfig, allPredictedLabels);
    for (const [label, idsSet] of Object.entries(result)) {
      const labelName = labelIdToName[label] || label;
      // Convert Set to array and count occurrences of each validating label
      const idsArr = Array.from(idsSet);
      const countMap = {};
      for (const id of idsArr) {
        const name = labelIdToName[id] || id;
        countMap[name] = (countMap[name] || 0) + 1;
      }
      // Build output array with counts
      const readableIdsWithCounts = Object.entries(countMap).map(([name, count]) => `${name} (${count})`);
      console.log(`Predicted label: ${labelName}`);
      console.log('Validating label IDs:', readableIdsWithCounts);
    }
    const endTime = Date.now();
    console.log(`Total execution time: ${(endTime - startTime) / 1000} seconds`);
    process.exit(0);
  } catch (err) {
    console.error('Error running generateValidationList:', err);
    process.exit(1);
  }
})();