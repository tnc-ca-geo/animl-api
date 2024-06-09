import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream/promises';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import { analysisConfig, reportColumns } from './analysisConfig.js';
import Image from '../../.build/api/db/schemas/Image.js';
import { ProjectModel } from '../../.build/api/db/models/Project.js';
import { stringify } from 'csv-stringify';
import cliProgress from 'cli-progress';

// Command to run this script:
// STAGE=prod AWS_PROFILE=animl REGION=us-west-2 node ./src/scripts/analyzeClassifierPerformance.js

const { ANALYSIS_DIR, PROJECT_ID, START_DATE, END_DATE, ML_MODEL, TARGET_CLASSES } = analysisConfig;

async function writeConfigToFile(filename, analysisPath, config) {
  const jsonFilename = path.join(analysisPath, `${filename}_config.json`);

  if (!fs.existsSync(analysisPath)) {
    fs.mkdirSync(analysisPath, { recursive: true });
  }

  try {
    const data = JSON.stringify(config, null, 2);
    await fs.writeFileSync(jsonFilename, data, 'utf8');
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
  console.log(
    `Analyzing ${ML_MODEL} performance in ${PROJECT_ID} Project between ${START_DATE} and ${END_DATE}...`,
  );
  console.log('Getting config...');
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    const project = await ProjectModel.queryById(PROJECT_ID);
    const cameraConfigs = project.cameraConfigs;

    // init progress bar
    const depCount = cameraConfigs.reduce(
      (acc, cameraConfig) => acc + (cameraConfig.deployments.length - 1), // subtract 1 to exclude default deployment
      0,
    );
    console.log(`Total deployments: ${depCount}`);
    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(depCount * TARGET_CLASSES.length, 0);

    // init reports
    const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
    const analysisPath = path.join(appRoot.path, ANALYSIS_DIR);
    if (!fs.existsSync(analysisPath)) {
      fs.mkdirSync(analysisPath, { recursive: true });
    }

    const root = `${PROJECT_ID}_${START_DATE}--${END_DATE}_${dt}`;
    await writeConfigToFile(root, analysisPath, analysisConfig);

    const csvFilename = path.join(analysisPath, `${root}.csv`);
    const writableStream = fs.createWriteStream(csvFilename);
    const stringifier = stringify({ header: true, columns: reportColumns });
    stringifier.on('error', (err) => console.error(err.message));

    for (const cameraConfig of cameraConfigs) {
      // console.log(`\nAnalyzing camera: ${cameraConfig._id}`);

      for (const dep of cameraConfig.deployments) {
        if (dep.name === 'default') continue; // skip default deployments

        for (const tClass of TARGET_CLASSES) {
          // get image-level counts
          const allActuals = (await getAllActuals(cameraConfig._id, tClass)).length;
          const TP = (await truePositives(cameraConfig._id, tClass)).length;
          const FP = (await falsePositives(cameraConfig._id, tClass)).length;
          const FN = (await falseNegatives(cameraConfig._id, tClass)).length;

          // calculate precision, recall, and F1 score
          const precision = TP / (TP + FP);
          const recall = TP / (TP + FN);
          const f1 = (2 * precision * recall) / (precision + recall); // harmonic mean

          // console.log('\n');
          // console.log(`${dep.name} - ${tClass.predicted_id} - all : ${allActuals}`);
          // console.log(`${dep.name} - ${tClass.predicted_id} - true positives : ${TP}`);
          // console.log(`${dep.name} - ${tClass.predicted_id} - false negatives : ${FN}`);
          // console.log(`${dep.name} - ${tClass.predicted_id} - false positives : ${FP}`);
          // console.log(`${dep.name} - ${tClass.predicted_id} - precision : ${precision}`);
          // console.log(`${dep.name} - ${tClass.predicted_id} - recall : ${recall}`);
          // console.log(`${dep.name} - ${tClass.predicted_id} - f1 : ${f1}`);

          // write row to csv
          stringifier.write({
            cameraId: cameraConfig._id,
            deploymentName: dep.name,
            targetClass: tClass.predicted_id,
            validationClasses: tClass.validation_ids.join(', '),
            allActuals: allActuals,
            truePositives: TP,
            falsePositives: FP,
            falseNegatives: FN,
            precision: Number.parseFloat(precision * 100).toFixed(2),
            recall: Number.parseFloat(recall * 100).toFixed(2),
            f1: Number.parseFloat(f1).toFixed(2),
          });

          progress.increment();
        }
      }
    }
    stringifier.end();

    await stream.pipeline(stringifier, writableStream);
    progress.stop();
    console.log(`\nAnalysis complete. Results written to ${csvFilename}`);

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    console.log(err);
  }
}

analyze();
