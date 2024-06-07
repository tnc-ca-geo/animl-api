import fs from 'node:fs';
import path from 'node:path';
// import { InternalServerError } from '../api/errors.js';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import Image from '../../.build/api/db/schemas/Image.js';

// STAGE=prod AWS_PROFILE=animl REGION=us-west-2 node ./src/scripts/analyzeClassifierPerformance.js

const ANALYSIS_DIR = '/analysis';
const OPERATION = 'X811494B-false-negative-rodents';
const CAMERA_ID = 'X811494B';
const START_DATE = '2023-4-26';
const END_DATE = '2024-5-29';
const TARGET_CLASS = 'rodent';
const VALIDATION_CLASSES = ['rodent', 'mouse', 'rat'];
const ML_MODEL = 'mirav2';

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

const basePipeline = [
  // return reviewed images for a camera between two dates
  {
    $match: {
      cameraId: CAMERA_ID,
      dateAdded: {
        $gt: new Date(START_DATE),
        $lt: new Date(END_DATE),
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

async function getAllActuals() {
  const pipeline = basePipeline.concat([
    // all actual match (should be equal to TP + FN)
    // NOTE: They are not adding up for X811494B. There are 7 that are neither TP nor FN.
    // Upon further inspection, it appears because images can have more than one prediction,
    // they can both have a TP and a FN prediction at the same tim.
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
                'firstValidLabel.labelId': { $in: VALIDATION_CLASSES },
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

async function truePositives() {
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
                'firstValidLabel.labelId': { $in: VALIDATION_CLASSES },
                labels: {
                  $elemMatch: {
                    $and: [{ type: 'ml' }, { mlModel: ML_MODEL }, { labelId: TARGET_CLASS }],
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

async function falseNegatives() {
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
                'firstValidLabel.labelId': { $in: VALIDATION_CLASSES },
                labels: {
                  // none of the labels are ml-predicted rodent
                  $not: {
                    $elemMatch: {
                      $and: [{ type: 'ml' }, { mlModel: ML_MODEL }, { labelId: TARGET_CLASS }],
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

async function falsePositives() {
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
                'firstValidLabel.labelId': { $nin: VALIDATION_CLASSES },
                labels: {
                  $elemMatch: {
                    $and: [{ type: 'ml' }, { mlModel: ML_MODEL }, { labelId: TARGET_CLASS }],
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
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {
    const allActuals = await getAllActuals();
    console.log('all actual count: ', allActuals.length);

    const truePos = await truePositives();
    console.log('true positive count: ', truePos.length);

    const falseNeg = await falseNegatives();
    console.log('false negative count: ', falseNeg.length);

    const falsePos = await falsePositives();
    console.log('false positive count: ', falsePos.length);

    // const mysteryIds = allActuals.filter((id) => !truePos.includes(id) && !falseNeg.includes(id));
    const mysteryIds = [];
    for (const id of truePos) {
      if (!allActuals.includes(id)) {
        console.log('true positive not in all actuals: ', id);
        mysteryIds.push(id);
      }
    }
    for (const id of falseNeg) {
      if (!allActuals.includes(id)) {
        console.log('false negative not in all actuals: ', id);
        mysteryIds.push(id);
      }
      if (truePos.includes(id)) {
        console.log('false negative is ALSO a true positive: ', id);
      }
    }
    console.log('mystery ids: ', mysteryIds);

    // console.log('found _id: ', _ids);
    // createLogFile(_ids, OPERATION);

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    console.log(err);
  }
}

analyze();
