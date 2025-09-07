import { getConfig } from '../../.build/config/config.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import Image from '../../.build/api/db/schemas/Image.js';
import Project from '../../.build/api/db/schemas/Project.js';
import MLModel from '../../.build/api/db/schemas/MLModel.js';
import cliProgress from 'cli-progress';
import fs from 'node:fs';
import util from 'util';
import path from 'node:path';
import appRoot from 'app-root-path';

async function getCount(pipeline) {
  console.log('getting image count');
  let count = null;
  try {
    const pipelineCopy = structuredClone(pipeline);
    pipelineCopy.push({ $count: 'count' });
    const res = await Image.aggregate(pipelineCopy);
    count = res[0] ? res[0].count : 0;
  } catch (err) {
    console.log('error counting Image: ', err);
  }
  return count;
}

const buildBasePipeline = (projectId) => [
  {
    $match: {
      projectId: projectId,
      reviewed: true,
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
];

// This generates the predicted and validating TARGET_CLASS list
// for analysis config.
//
// 1. Get ML model categories for target model
// 2. Map categories to project labels by name
// 3. Get all images in project which have a label
// from the target ML model
// 4. For the first ML model label found, add the
// representative label to its validating list
export const generateValidationList = async (genConfig) => {
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    const { PROJECT_ID, MODEL } = genConfig;

    console.log('fetching project labels...');
    const project = await Project.findOne({
      _id: PROJECT_ID
    });
    const projectLabels = project.labels.reduce((acc, lbl) => {
      acc[lbl._id] = lbl.name;
      return acc;
    }, {});

    console.log('fetching model labels...');
    const model = await MLModel.findOne({
      _id: MODEL
    });

    const modelLabelIds = model.categories.reduce((acc, category) => {
      const projectLabel = project.labels.find((lbl) => lbl.name === category.name);
      if (!projectLabel) {
        return acc;
      }
      acc.push(projectLabel._id);
      return acc;
    }, []);

    const validationLabels = modelLabelIds.reduce((acc, lblId) => {
      acc[lblId] = new Set();
      return acc;
    }, {});

    const baseImagePipeline = buildBasePipeline(PROJECT_ID);
    const imageCount = await getCount(baseImagePipeline);

    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);

    progress.start(imageCount, 0);
    for await (const img of Image.aggregate(baseImagePipeline)) {
      for (const obj of img.objects) {
        const firstValidated = obj.firstValidLabel.shift();
        const predicted = obj.labels.find((lbl) => lbl.mlModel === MODEL);

        if (!firstValidated || !predicted) {
          continue;
        }

        validationLabels[predicted.labelId].add(firstValidated.labelId);
      }

      progress.increment();
    }
    progress.stop();

    console.log('Mapping label IDs to label names...');

    const validationListsWithNames = Object.entries(validationLabels).map(([labelId, validations]) => {
      const labelName = projectLabels[labelId];

      const validationNames = Array.from(validations).map((validation) => {
        return `${projectLabels[validation]}:${validation}`;
      });

      return {
        predicted: `${labelName}:${labelId}`,
        validation: validationNames,
      };
    });

    return validationListsWithNames;
  } catch (err) {
    console.error(`An error occurred while generating the validation lists: ${err}`);
  } finally {
    console.log('Closing db connection...');
    await dbClient.connection.close();
  }
};

const writeToFile = (config, output) => {
  const { ANALYSIS_DIR } = config;
  const analysisPath = path.join(appRoot.path, ANALYSIS_DIR);
  const outputFilename = path.join(analysisPath, 'GENERATED_TARGET_CLASSES.js');

  if (!fs.existsSync(analysisPath)) {
    fs.mkdirSync(analysisPath, { recursive: true });
  }

  try {
    fs.writeFileSync(outputFilename, output, 'utf8');
  } catch (err) {
    throw console.log(err instanceof Error ? err.message : String(err));
  }
};

// This generates a list of predicted vs validating classes for the
// target project and ML model.  This list should be reviewed and
// copied into the TARGET_CLASSES section of analysisConfig.js
//
// Usage:
// ```
// STAGE=prod AWS_PROFILE=animl REGION=us-west-2  node ./src/scripts/generateValidating.js
// ```
const generateValidationListConfig = {
  ANALYSIS_DIR: '/analysis',
  PROJECT_ID: 'palmyra_bucket_test',
  MODEL: 'speciesnet-classifier',
};
const validationIdLists = await generateValidationList(generateValidationListConfig);
writeToFile(generateValidationListConfig, util.inspect(validationIdLists));
