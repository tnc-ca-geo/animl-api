import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import { analysisConfig } from './analysisConfig.js';
import Image from '../../.build/api/db/schemas/Image.js';
import { ProjectModel } from '../../.build/api/db/models/Project.js';

// Command to run this script:
// STAGE=prod AWS_PROFILE=animl REGION=us-west-2 node ./src/scripts/analyzeClassifierPerformance.js

const { ANALYSIS_DIR, PROJECT_ID, START_DATE, END_DATE, ML_MODEL, TARGET_CLASSES } = analysisConfig;

async function createLogFile(_ids, operation) {
  const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
  const analysisPath = path.join(appRoot.path, ANALYSIS_DIR);
  const fileName = path.join(analysisPath, `${operation}_${dt}.json`);

  if (!fs.existsSync(analysisPath)) {
    fs.mkdirSync(analysisPath, { recursive: true });
  }

  try {
    const data = JSON.stringify({
      date: dt,
      modification: operation,
      _ids,
    });
    await fs.writeFileSync(fileName, data, 'utf8');
  } catch (err) {
    throw console.log(err instanceof Error ? err.message : String(err));
  }
}

// MongoDB Aggregation Pipeline to calculate
// true positives (TP), false positives (FP), and false negatives (FN) for a given target class
//
// NOTE: this will count the number of images that contain at least one TP/FP/FN prediction, not the number of individual objects.
//
// also note that this is only relevant to Projects using classifiers (or object detectors paired with classifiers)
// it will not work for projects using object detectors alone. So if using an object detector, a true positive
// would mean that the object detector correctly identified the object, and the classifier correctly identified the class.
// However, a false negative COULD mean that the object detector correctly identified the object, but the classifier incorrectly identified the class.

const buildBasePipeline = (cameraId, startDate, endDate) => [
  // return reviewed images for a camera between two dates
  {
    $match: {
      cameraId: cameraId,
      dateAdded: {
        $gt: new Date(startDate),
        $lt: new Date(endDate),
      },
      reviewed: true,
    },
  },

  // set the firstValidLabel field
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

async function getAllActuals(cameraId, tClass) {
  const basePipeline = buildBasePipeline(cameraId, START_DATE, END_DATE);
  const pipeline = basePipeline.concat([
    // all actual match
    // NOTE: in theory, all actuals should be equal to TP + FN, however,
    // because images can have more than one prediction,
    // they can both have a TP and a FN prediction at the same time, so at the image level,
    // they are not mutually exclusive and thus may not add up perfectly
    {
      $match: {
        // has an object that is (a) locked,
        // (b) has a first valid label that validates the prediction/target class,
        // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
        objects: {
          $elemMatch: {
            $and: [
              {
                locked: true,
                'firstValidLabel.labelId': { $in: tClass.validation_ids },
              },
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
      },
    },
  ]);

  const res = await Image.aggregate(pipeline);
  return res.map((item) => item._id);
}

async function truePositives(cameraId, tClass) {
  const basePipeline = buildBasePipeline(cameraId, START_DATE, END_DATE);
  const pipeline = basePipeline.concat([
    // true positive match
    {
      $match: {
        // has an object that is (a) locked,
        // (b) has an ml-predicted label of the target class, and
        // (c) has a first valid label that validates the prediction/target class,
        // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
        objects: {
          $elemMatch: {
            $and: [
              {
                locked: true,
                'firstValidLabel.labelId': { $in: tClass.validation_ids },
                labels: {
                  $elemMatch: {
                    $and: [{ type: 'ml' }, { mlModel: ML_MODEL }, { labelId: tClass.predicted_id }],
                  },
                },
              },
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
      },
    },
  ]);

  const res = await Image.aggregate(pipeline);
  return res.map((item) => item._id);
}

async function falseNegatives(cameraId, tClass) {
  const basePipeline = buildBasePipeline(cameraId, START_DATE, END_DATE);
  const pipeline = basePipeline.concat([
    // false negative match
    {
      $match: {
        // has an object that is (a) locked,
        // (b) has a first valid label that validates the prediction/target class,
        // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
        // and (c) does not have an ml-predicted label of the target class
        objects: {
          $elemMatch: {
            $and: [
              {
                locked: true,
                'firstValidLabel.labelId': { $in: tClass.validation_ids },
                labels: {
                  // none of the labels are ml-predicted rodent
                  $not: {
                    $elemMatch: {
                      $and: [
                        { type: 'ml' },
                        { mlModel: ML_MODEL },
                        { labelId: tClass.predicted_id },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
      },
    },
  ]);

  const res = await Image.aggregate(pipeline);
  return res.map((item) => item._id);
}

async function falsePositives(cameraId, tClass) {
  const basePipeline = buildBasePipeline(cameraId, START_DATE, END_DATE);
  const pipeline = basePipeline.concat([
    {
      $match: {
        // has an object that is (a) locked,
        // (b) has an ml-predicted label of the target class, and
        // (c) DOES NOT have a first valid label that validates the prediction/target class,
        // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
        objects: {
          $elemMatch: {
            $and: [
              {
                locked: true,
                'firstValidLabel.labelId': { $nin: tClass.validation_ids },
                labels: {
                  $elemMatch: {
                    $and: [{ type: 'ml' }, { mlModel: ML_MODEL }, { labelId: tClass.predicted_id }],
                  },
                },
              },
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
      },
    },
  ]);

  const res = await Image.aggregate(pipeline);
  return res.map((item) => item._id);
}

async function analyze() {
  console.log('Analyzing classifier performance...');
  console.log('Getting config...');
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    const project = await ProjectModel.queryById(PROJECT_ID);
    const cameraConfigs = project.cameraConfigs;

    // TODO: start csv?

    for (const cameraConfig of cameraConfigs) {
      console.log(`\nAnalyzing camera: ${cameraConfig._id}`);

      for (const dep of cameraConfig.deployments) {
        if (dep.name === 'default') continue; // skip default deployments

        for (const tClass of TARGET_CLASSES) {
          // get image-level counts
          const allActuals = (await getAllActuals(cameraConfig._id, tClass)).length;
          const TP = (await truePositives(cameraConfig._id, tClass)).length;
          const FN = (await falseNegatives(cameraConfig._id, tClass)).length;
          const FP = (await falsePositives(cameraConfig._id, tClass)).length;

          // calculate precision, recall, and F1 score
          const precision = TP / (TP + FP);
          const recall = TP / (TP + FN);
          const f1 = (2 * precision * recall) / (precision + recall); // harmonic mean

          console.log(`${dep.name} - ${tClass.predicted_id} - all : ${allActuals}`);
          console.log(`${dep.name} - ${tClass.predicted_id} - true positives : ${TP}`);
          console.log(`${dep.name} - ${tClass.predicted_id} - false negatives : ${FN}`);
          console.log(`${dep.name} - ${tClass.predicted_id} - false positives : ${FP}`);
          console.log(`${dep.name} - ${tClass.predicted_id} - precision : ${precision}`);
          console.log(`${dep.name} - ${tClass.predicted_id} - recall : ${recall}`);
          console.log(`${dep.name} - ${tClass.predicted_id} - f1 : ${f1}`);

          // TODO: write row to csv
        }
      }
    }

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    console.log(err);
  }
}

analyze();
