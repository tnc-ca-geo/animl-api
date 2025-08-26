import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream/promises';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import { stringify } from 'csv-stringify';
import cliProgress from 'cli-progress';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import { analysisConfig, reportColumns } from './analysisConfig.js';
import Image from '../../.build/api/db/schemas/Image.js';
import { ProjectModel } from '../../.build/api/db/models/Project.js';

/*
 * Script to analyze ML model performance at the object level
 *
 * NOTE: you can use this script to analyze the performance of MegaDetector independently,
 * or of a classifier that's been paired with an object detector in an inference pipeline.
 * Keep in mind that if assessing the latter, a true positive would mean that
 * (a) the object detector correctly identified the object, and (b) the classifier correctly identified the class.
 * So a false negative _could_ mean that the object detector correctly identified the object,
 * but the classifier incorrectly identified the class.
 *
 * The reason that's worth noting is because at the moment it doesn't support evaluating the performance
 * of a classifier independently of an object detector.
 *
 * ALSO NOTE: it is assumed that the model being analyzed was used for the entire duration of the date range.
 * This script, and Animl in general, doesn't know when a model was deployed, renamed, or automation rules applied,
 * and we currently do not store inference _request_ data at the image level (though we should)
 * so it's up to the user to ensure the model was used for the entire date range.
 *
 * If Animl never requested inference for the model being analyzed for some image(s) in the date range,
 * but there are validating labels in those images, those images will be counted as false negatives,
 * which will significantly skew the results (model will appear to to have worse recall than it actually does).
 *
 * command to run script:
 * STAGE=prod AWS_PROFILE=animl REGION=us-west-2 node ./src/scripts/analyzeMLObjectLevel.js
 */

const { ADJUSTABLE_WINDOW, ANALYSIS_DIR, PROJECT_ID, START_DATE, END_DATE, ML_MODEL } = analysisConfig;

const TARGET_CLASSES = analysisConfig.TARGET_CLASSES.map((tc) => ({
  predicted_id: tc.predicted.split(':')[1],
  validation_ids: tc.validation.map((v) => v.split(':')[1]),
  predicted_name: tc.predicted.split(':')[0],
  validation_names: tc.validation.map((v) => v.split(':')[0]),
}));

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
        $gte: new Date(startDate),
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
    // console.log('pipelineCopy: ', JSON.stringify(pipelineCopy, null, 2));
    const res = await Image.aggregate(pipelineCopy);
    count = res[0] ? res[0].count : 0;
  } catch (err) {
    console.log('error counting Image: ', err);
  }
  return count;
}

function FVLValidatesPrediction(obj, tClass) {
  // if no firstValidLabel, all labels have been invalidated, so return false
  if (obj.firstValidLabel.length === 0) return false;
  const fvl = obj.firstValidLabel[0]?.labelId;
  // if the ml model is megadetector and the target class is '1' (animal),
  // any firstValidLabel that is not is a person or vehicle or 'empty'
  // would validate the prediction
  if (ML_MODEL.includes('megadetector') && tClass.predicted_id === '1') {
    return fvl !== '2' && fvl !== '3' && fvl !== 'empty';
  } else {
    return tClass.validation_ids.includes(fvl);
  }
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
            targetClass: tClass.predicted_name,
            validationClasses: tClass.validation_names.join(', '),
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

    const root = `${PROJECT_ID}_${ML_MODEL}_${START_DATE}--${END_DATE}_object-level_${dt}`;
    await writeConfigToFile(root, analysisPath, analysisConfig);

    const csvFilename = path.join(analysisPath, `${root}.csv`);
    const writableStream = fs.createWriteStream(csvFilename);
    const stringifier = stringify({ header: true, columns: reportColumns });
    stringifier.on('error', (err) => console.error(err.message));

    // stream in images from MongoDB
    const aggPipeline = buildBasePipeline(PROJECT_ID, START_DATE, END_DATE);
    const imgCount = await getCount(aggPipeline);
    console.log('image count: ', imgCount);

    let aggregateImages = await Image.aggregate(aggPipeline);
    if (ADJUSTABLE_WINDOW) {
      const firstMlLabelAfterStartQuery = {
        $match: { 
          projectId: PROJECT_ID,
          dateAdded: {
            $gte: new Date(START_DATE),
            $lt: new Date(END_DATE),
          },
          reviewed: true,
          objects: {
            $elemMatch: {
              labels: {
                $elemMatch: {
                  mlModel: ML_MODEL
                }
              }
            }
          }
        },
      }

      const firstMlLabelAterStart = await Image.aggregate([
        firstMlLabelAfterStartQuery,
        { $sort: { dateAdded: 1 }},
        { $limit: 1 },
      ]))

      const isValidStartEndToMlDeployment = (img) => {
        if (!img.objects) return false;
        const validObjs = img.objects.filter((obj) => {
          return !obj.locked 
            || !obj.labels 
            || !obj.labels.some((lbl) => lbl.mlModel === ML_MODEL);
        })
        return validObjs.length > 0
      }
      return
      const earliestMlImage = aggregateImages.findIndex((img) => isValidStartEndToMlDeployment(img));
      const latestMlImage = aggregateImages.findLastIndex((img) => isValidStartEndToMlDeployment(img));

      if (earliestMlImage > latestMlImage) {
        throw new Error(`The evaluation script found an incorrect range.  Found start: ${earliestMlImage}, Found end: ${latestMlImage}`)
      }

      if (earliestMlImage < 0) {
        throw new Error(`The deployment window, ${START_DATE} - ${END_DATE}, does not include any images evaluated by ${ML_MODEL}`);
      }

      console.log(`a more accurate start date was found: ${aggregateImages[earliestMlImage].dateAdded}`)
      if (latestMlImage >= 0) {
        console.log(`a more accurate end date was found: ${aggregateImages[latestMlImage].dateAdded}`)
      }

      aggregateImages = aggregateImages.slice(earliestMlImage, latestMlImage);
    }

    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(imgCount, 0);

    for (const img of aggregateImages) {
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
          if (obj.locked && FVLValidatesPrediction(obj, tClass)) {
            data[key].allActuals++;
            // console.log(
            //   `actual ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
            // );
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
            FVLValidatesPrediction(obj, tClass)
          ) {
            data[key].truePositives++;
            // console.log(
            //   `TP ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
            // );
          }

          // FALSE POSITIVE - object must be:
          // (a) locked, (b) has an ml-predicted label of the target class, and
          // (c) DOES NOT have a first valid label that validates the prediction/target class
          if (
            obj.locked &&
            obj.labels.some(
              (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
            ) &&
            !FVLValidatesPrediction(obj, tClass)
          ) {
            data[key].falsePositives++;
            // console.log(
            //   `FP ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
            // );
          }

          // FALSE NEGATIVE - object must be:
          // (a) locked, (b) has a first valid label that validates the prediction/target class,
          // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
          // and (c) does NOT have an ml-predicted label of the target class
          if (
            obj.locked &&
            FVLValidatesPrediction(obj, tClass) &&
            !obj.labels.some(
              (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === tClass.predicted_id,
            )
          ) {
            data[key].falseNegatives++;
            // console.log(
            //   `FN ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
            // );
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
      const tClassRows = Object.values(data).filter((v) => v.targetClass === tClass.predicted_name);

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
        targetClass: tClass.predicted_name,
        validationClasses: tClass.validation_names.join(', '),
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
