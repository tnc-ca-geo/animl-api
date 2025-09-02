import { analysisConfig } from './analysisConfig.js';
import { getConfig } from '../../.build/config/config.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import Image from '../../.build/api/db/schemas/Image.js';
import Project from '../../.build/api/db/schemas/Project.js';

export const generateValidationList = async (analysisConfig, predictedLabels) => {
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    const { PROJECT_ID, START_DATE, END_DATE, ML_MODEL } = analysisConfig;

    // Prepare map { labelId: [validatingLabelId] }
    const validatingLabels = predictedLabels.reduce((acc, lbl) => {
      return { ...acc, [lbl]: [] };
    }, {});

    console.log('Collecting images...');
    const imageDbTimer = performance.now();
    const images = await Image.aggregate([{
      $match: {
        projectId: PROJECT_ID,
        dateAdded: {
          $gte: new Date(START_DATE),
          $lte: new Date(END_DATE),
        },
        reviewed: true,
        'objects.labels.labelId': {
          $in: predictedLabels
        }
      },
    }]);
    console.log(`Image db query time: ${(performance.now() - imageDbTimer) / 1000}`);

    console.log('Building validation lists...');
    const processTimer = performance.now();
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

        validatingLabels[mlLabel.labelId] = new Set([...validating, ...ids]);
      });
      return imgAcc;
    }, validatingLabels);
    console.log(`Validation list generation time: ${(performance.now() - processTimer) / 1000}`);

    const projectDbTime = performance.now();
    const project = await Project.findOne({
      _id: PROJECT_ID
    });
    console.log(`Project db query time: ${(performance.now() - projectDbTime) / 1000}`);

    console.log('Mapping label IDs to label names...');
    const nameTimer = performance.now();
    const labelNames = project.labels.reduce((acc, lbl) => {
      acc[lbl._id] = lbl.name;
      return acc;
    }, {});

    const validationListWithNames = Object.entries(validationLists).map(([labelId, validations]) => {
      const labelName = labelNames[labelId];

      const validationNames = Array.from(validations).map((validation) => {
        return `${labelNames[validation]}:${validation}`;
      });

      return {
        [`${labelName}:${labelId}`]: validationNames
      };
    });
    console.log(`Label name mapping time: ${(performance.now() - nameTimer) / 1000}`);

    return validationListWithNames;
  } catch (err) {
    console.error(`An error occurred while generating the validation lists: ${err}`);
  } finally {
    console.log('Closing db connection...');
    await dbClient.connection.close();
  }
};

// Example
const startTimer = performance.now();

const validationIdLists = await generateValidationList(analysisConfig, [
  'rodent', 'skunk', 'lizard', 'fox', 'bird'
]);

const endTimer = performance.now();
console.log(`Overall execution time: ${(endTimer - startTimer) / 1000} seconds`);

console.log(validationIdLists);
