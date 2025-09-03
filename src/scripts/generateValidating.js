import { getConfig } from '../../.build/config/config.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import Image from '../../.build/api/db/schemas/Image.js';
import Project from '../../.build/api/db/schemas/Project.js';

const generateValidationListConfig = {
  PROJECT_ID: 'sci_biosecurity',
  START_DATE: '2023-4-28',
  END_DATE: '2024-5-29',
  SKIP_MODELS: ['megadetector'],
  SKIP_EMPTY: true
};

export const generateValidationList = async (genConfig) => {
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    const { PROJECT_ID, START_DATE, END_DATE, SKIP_MODELS, SKIP_EMPTY } = genConfig;

    const projectDbTime = performance.now();
    const project = await Project.findOne({
      _id: PROJECT_ID
    });
    console.log(`Project db query time: ${(performance.now() - projectDbTime) / 1000} seconds`);

    const projectLabels = project.labels.reduce((acc, lbl) => {
      acc[lbl._id] = lbl.name;
      return acc;
    }, {});
    const projectLabelIds = Object.keys(projectLabels);

    // Prepare map { labelId: [validatingLabelId] }
    const validatingLabels = projectLabelIds.reduce((acc, lbl) => {
      return { ...acc, [lbl]: [] };
    }, {});

    console.log('Collecting images...');
    const imageDbTimer = performance.now();

    const images = await Image.aggregate([
      {
        $match: {
          projectId: PROJECT_ID,
          dateAdded: {
            $gte: new Date(START_DATE),
            $lte: new Date(END_DATE),
          },
          reviewed: true,
          'objects.labels.labelId': {
            $in: projectLabelIds
          },
          'objects.labels.validation.validated': true,
        },
      },
      {
        $set: {
          objects: {
            $map: {
              input: '$objects',
              as: 'obj',
              in: {
                $setField: {
                  field: 'firstValidLabel',
                  input: '$$obj',
                  value: {
                    $filter: {
                      input: '$$obj.labels',
                      as: 'label',
                      cond: {
                        $eq: ['$$label.validation.validated', true],
                      },
                      limit: 1,
                    },
                  },
                },
              },
            },
          },
        },
      },
      {
        $set: {
          objects: {
            $map: {
              input: '$objects',
              as: 'obj',
              in: {
                $setField: {
                  field: 'filteredLabels',
                  input: '$$obj',
                  value: {
                    $filter: {
                      input: '$$obj.labels',
                      as: 'label',
                      cond: {
                        $and: [
                          { $ne: ['$$obj.firstValidLabel.labelId', null] },
                          { $eq: ['$$label.validation.validated', true] },
                          { $ne: ['$$label.mlModel', { $in: ['$$label.mlModel', SKIP_MODELS]} ]},
                          ...( SKIP_EMPTY && [{ $ne: ['$$label.labelId', 'empty'] }])
                        ]
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    console.log(`Image db query time: ${(performance.now() - imageDbTimer) / 1000} seconds`);

    console.log('Building validation lists...');
    const processTimer = performance.now();

    const validationLists = images.reduce((imgAcc, img) => {
      img.objects.forEach((obj) => {
        if (!obj.firstValidLabel || obj.firstValidLabel.length < 1) {
          return;
        }

        const labelIds = obj.filteredLabels.map((lbl) => lbl.labelId);
        const firstValidLabelId = obj.firstValidLabel.shift().labelId;
        const curr = validatingLabels[firstValidLabelId];
        validatingLabels[firstValidLabelId] = new Set([...curr, ...labelIds]);
      });
      return imgAcc;
    }, validatingLabels);

    console.log(`Validation list generation time: ${(performance.now() - processTimer) / 1000} seconds`);

    console.log('Mapping label IDs to label names...');
    const nameTimer = performance.now();

    const validationListsWithNames = Object.entries(validationLists).map(([labelId, validations]) => {
      const labelName = projectLabels[labelId];

      const validationNames = Array.from(validations).map((validation) => {
        return `${projectLabels[validation]}:${validation}`;
      });

      return {
        [`${labelName}:${labelId}`]: validationNames
      };
    });

    console.log(`Label name mapping time: ${(performance.now() - nameTimer) / 1000} seconds`);

    return validationListsWithNames;
  } catch (err) {
    console.error(`An error occurred while generating the validation lists: ${err}`);
  } finally {
    console.log('Closing db connection...');
    await dbClient.connection.close();
  }
};

// Example
const startTimer = performance.now();

const validationIdLists = await generateValidationList(generateValidationListConfig);

const endTimer = performance.now();
console.log(`Overall execution time: ${(endTimer - startTimer) / 1000} seconds`);

console.log(validationIdLists);
