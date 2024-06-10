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
 * Script to analyze classifier performance at the object level
 *
 * Note: this is only relevant to Projects using classifiers (or object detectors paired with classifiers)
 * it will not work for projects using object detectors alone. So if using an object detector, a true positive
 * would mean that the object detector correctly identified the object, and the classifier correctly identified the class.
 * However, a false negative COULD mean that the object detector correctly identified the object, but the classifier incorrectly identified the class.
 *
 * command to run:
 * STAGE=prod AWS_PROFILE=animl REGION=us-west-2 node ./src/scripts/analyzeClassifierPerformanceObject.js
 */

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

function getDeployment(img, cameraConfigs) {
  return cameraConfigs
    .find((cc) => cc._id.toString() === img.cameraId.toString())
    .deployments.find((dep) => dep._id.toString() === img.deploymentId.toString());
}

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

// main function
async function analyze() {
  console.log(
    `Analyzing ${ML_MODEL} performance in ${PROJECT_ID} Project between ${START_DATE} and ${END_DATE}...`,
  );
  console.log('Getting config...');
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    // set up data structure to hold results
    const project = await ProjectModel.queryById(PROJECT_ID);
    const cameraConfigs = project.cameraConfigs;
    const data = {};
    cameraConfigs.forEach((cc) => {
      for (const dep of cc.deployments) {
        if (dep.name === 'default') continue; // skip default deployments
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

    const root = `${PROJECT_ID}_${START_DATE}--${END_DATE}_object-level_${dt}`;
    await writeConfigToFile(root, analysisPath, analysisConfig);

    const csvFilename = path.join(analysisPath, `${root}.csv`);
    const writableStream = fs.createWriteStream(csvFilename);
    const stringifier = stringify({ header: true, columns: reportColumns });
    stringifier.on('error', (err) => console.error(err.message));

    // stream in images from MongoDB
    const aggPipeline = buildBasePipeline(PROJECT_ID, START_DATE, END_DATE);
    const imgCount = await getCount(aggPipeline);
    console.log('image count: ', imgCount);
    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(imgCount, 0);

    for await (const img of Image.aggregate(aggPipeline)) {
      // skip default deployments
      const imgDep = getDeployment(img, cameraConfigs);
      if (imgDep.name === 'default') continue;

      // iterate over objects and count up TPs, FPs, and FNs for all target classes
      for (const obj of img.objects) {
        for (const tClass of TARGET_CLASSES) {
          const key = `${imgDep._id}_${tClass.predicted_id}`;

          // ACTUAL - object must be:
          // (a) locked, (b) has a first valid label that validates the prediction/target class,
          // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
          if (obj.locked && tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId)) {
            data[key].allActuals++;
          }

          // TRUE POSITIVE - object must be:
          // (a) locked, (b) has an ml-predicted label of the target class, and
          // (c) has a first valid label that validates the prediction/target class,
          // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
          if (
            obj.locked &&
            obj.labels.some(
              (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
            ) &&
            tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId)
          ) {
            data[key].truePositives++;
          }

          // FALSE POSITIVE - object must be:
          // (a) locked, (b) has an ml-predicted label of the target class, and
          // (c) DOES NOT have a first valid label that validates the prediction/target class
          if (
            obj.locked &&
            obj.labels.some(
              (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
            ) &&
            !tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId)
          ) {
            data[key].falsePositives++;
          }

          // FALSE NEGATIVE - object must be:
          // (a) locked, (b) has a first valid label that validates the prediction/target class,
          // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
          // and (c) does NOT have an ml-predicted label of the target class
          if (
            obj.locked &&
            tClass.validation_ids.includes(obj.firstValidLabel[0]?.labelId) &&
            !obj.labels.some(
              (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
            )
          ) {
            data[key].falseNegatives++;
          }
        }
      }

      progress.increment();
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

      // write row to csv
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

      // write row to csv
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
