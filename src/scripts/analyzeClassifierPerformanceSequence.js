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

/*
 * Script to analyze classifier performance at the sequence level
 *
 * Note: this is only relevant to Projects using classifiers (or object detectors paired with classifiers)
 * it will not work for projects using object detectors alone. So if using an object detector, a true positive
 * would mean that the object detector correctly identified the object, and the classifier correctly identified the class.
 * However, a false negative COULD mean that the object detector correctly identified the object, but the classifier incorrectly identified the class.
 *
 * command to run:
 * STAGE=prod AWS_PROFILE=animl REGION=us-west-2 node ./src/scripts/analyzeClassifierPerformanceSequence.js
 */

const {
  ANALYSIS_DIR,
  PROJECT_ID,
  START_DATE,
  END_DATE,
  ML_MODEL,
  TARGET_CLASSES,
  MAX_SEQUENCE_DELTA,
} = analysisConfig;

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

const buildBasePipeline = (projectId, startDate, endDate) => [
  // return reviewed images for a camera between two dates
  {
    $match: {
      projectId: projectId,
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

// ACTUAL - object must be:
// (a) locked, (b) has a first valid label that validates the prediction/target class,
// (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
const isActual = (obj, tClass) =>
  obj.locked && tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId);

// TRUE POSITIVE - object must be:
// (a) locked, (b) has an ml-predicted label of the target class, and
// (c) has a first valid label that validates the prediction/target class,
// (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
const isTruePositive = (obj, tClass) =>
  obj.locked &&
  obj.labels.some(
    (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
  ) &&
  tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId);

// FALSE POSITIVE - object must be:
// (a) locked, (b) has an ml-predicted label of the target class, and
// (c) DOES NOT have a first valid label that validates the prediction/target class
const isFalsePositive = (obj, tClass) =>
  obj.locked &&
  obj.labels.some(
    (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
  ) &&
  !tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId);

// FALSE NEGATIVE - object must be:
// (a) locked, (b) has a first valid label that validates the prediction/target class,
// (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
// and (c) does NOT have an ml-predicted label of the target class
const isFalseNegative = (obj, tClass) =>
  obj.locked &&
  tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId) &&
  !obj.labels.some(
    (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
  );

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

function processSequence(sequence, deployment, data) {
  for (const tClass of TARGET_CLASSES) {
    const key = `${deployment._id}_${tClass.predicted_id}`;
    let hasActual = false;
    let hasTruePositive = false;
    let hasFalsePositive = false;

    for (const img of sequence) {
      for (const obj of img.objects) {
        if (!hasActual) {
          hasActual = isActual(obj, tClass);
        }

        if (!hasTruePositive) {
          hasTruePositive = isTruePositive(obj, tClass);
        }

        if (!hasFalsePositive) {
          hasFalsePositive = isFalsePositive(obj, tClass);
        }
      }
    }

    if (hasActual) data[key].allActuals++;
    if (hasTruePositive) data[key].truePositives++;
    if (hasActual && !hasTruePositive) data[key].falseNegatives++;
    if (!hasActual && hasFalsePositive) data[key].falsePositives++;
  }
  return data;
}

// main function
async function analyze() {
  console.log(
    `Analyzing ${ML_MODEL} performance in ${PROJECT_ID} Project between ${START_DATE} and ${END_DATE} at the sequence level...`,
  );
  console.log('Getting config...');
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    // set up data structure to hold results
    const project = await ProjectModel.queryById(PROJECT_ID);
    const cameraConfigs = project.cameraConfigs;
    let data = {};
    const deployments = [];
    cameraConfigs.forEach((cc) => {
      for (const dep of cc.deployments) {
        if (dep.name === 'default') continue; // skip default deployments
        deployments.push(dep);
        for (const tClass of TARGET_CLASSES) {
          data[`${dep._id}_${tClass.predicted_id}`] = {
            cameraId: cc._id,
            deploymentName: dep.name,
            targetClass: tClass.predicted_id,
            validationClasses: tClass.validation_ids.join(', '),
            allActuals: 0,
            truePositives: 0,
            falsePositives: 0,
            falseNegatives: 0,
            precision: null,
            recall: null,
            f1: null,
          };
        }
      }
    });

    // init reports
    const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
    const analysisPath = path.join(appRoot.path, ANALYSIS_DIR);
    if (!fs.existsSync(analysisPath)) {
      fs.mkdirSync(analysisPath, { recursive: true });
    }

    const root = `${PROJECT_ID}_${START_DATE}--${END_DATE}_sequence-level_${dt}`;
    await writeConfigToFile(root, analysisPath, analysisConfig);

    const csvFilename = path.join(analysisPath, `${root}.csv`);
    const writableStream = fs.createWriteStream(csvFilename);
    const stringifier = stringify({ header: true, columns: reportColumns });
    stringifier.on('error', (err) => console.error(err.message));

    // get image count
    const aggPipeline = buildBasePipeline(PROJECT_ID, START_DATE, END_DATE);
    const imgCount = await getCount(aggPipeline);
    console.log('image count: ', imgCount);
    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(imgCount, 0);

    // for each deployment, stream in images in chronological order
    // group them into sequences,
    // and process each sequence to count TPs, FPs, and FNs
    for (const dep of deployments) {
      // if (dep.name !== 'Willows beach') continue;
      // create aggregation pipeline
      const depPipeline = structuredClone(aggPipeline);
      depPipeline[0].$match.deploymentId = dep._id;
      depPipeline.push({ $sort: { dateTimeOriginal: 1 } });

      let sequence = [];
      const depImageCount = await Image.aggregate(depPipeline);
      let processedCount = 0;

      for await (const img of Image.aggregate(depPipeline)) {
        if (sequence.length === 0) {
          sequence.push(img);
          continue;
        }

        const lastImg = sequence[sequence.length - 1];
        const imgDateAdded = DateTime.fromJSDate(img.dateTimeOriginal);
        const lastImgDateAdded = DateTime.fromJSDate(lastImg.dateTimeOriginal);
        const diff = lastImgDateAdded.diff(imgDateAdded, 'seconds').toObject();
        const delta = Math.abs(diff.seconds);

        // if the delta between the last image and the current image is less than the max sequence delta,
        if (delta <= MAX_SEQUENCE_DELTA) {
          // image belongs to current sequence
          sequence.push(img);
        } else {
          // found a gap,
          // process images previously assigned to sequence and reset sequence
          data = processSequence(sequence, dep, data);
          sequence = [img];
        }
        processedCount++;

        // we've reached the end of the deployment
        if (processedCount === depImageCount.length - 1) {
          data = processSequence(sequence, dep, data);
        }

        progress.increment();
      }
    }

    progress.stop();
    console.log(`\nAnalysis complete. Writing results to ${csvFilename}`);

    // write results to csv
    for (const value of Object.values(data)) {
      // calculate precision, recall, and F1 score
      const TP = value.truePositives;
      const FP = value.falsePositives;
      const FN = value.falseNegatives;
      const precision = TP / (TP + FP);
      const recall = TP / (TP + FN);
      const f1 = (2 * precision * recall) / (precision + recall); // harmonic mean

      stringifier.write({
        ...value,
        allActuals: value.allActuals,
        truePositives: TP,
        falsePositives: FP,
        falseNegatives: FN,
        precision: Number.parseFloat(precision * 100).toFixed(2),
        recall: Number.parseFloat(recall * 100).toFixed(2),
        f1: Number.parseFloat(f1).toFixed(2),
      });
    }

    // add rows for target class totals
    for (const tClass of TARGET_CLASSES) {
      const tClassRows = Object.values(data).filter((v) => v.targetClass === tClass.predicted_id);

      const totalActuals = tClassRows.reduce((acc, v) => acc + v.allActuals, 0);
      const totalTP = tClassRows.reduce((acc, v) => acc + v.truePositives, 0);
      const totalFP = tClassRows.reduce((acc, v) => acc + v.falsePositives, 0);
      const totalFN = tClassRows.reduce((acc, v) => acc + v.falseNegatives, 0);
      const precision = totalTP / (totalTP + totalFP);
      const recall = totalTP / (totalTP + totalFN);
      const f1 = (2 * precision * recall) / (precision + recall);

      stringifier.write({
        cameraId: 'total',
        deploymentName: 'total',
        targetClass: tClass.predicted_id,
        validationClasses: tClass.validation_ids.join(', '),
        allActuals: totalActuals,
        truePositives: totalTP,
        falsePositives: totalFP,
        falseNegatives: totalFN,
        precision: Number.parseFloat(precision * 100).toFixed(2),
        recall: Number.parseFloat(recall * 100).toFixed(2),
        f1: Number.parseFloat(f1).toFixed(2),
      });
    }

    stringifier.end();

    await stream.pipeline(stringifier, writableStream);

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    console.log(err);
  }
}

analyze();
