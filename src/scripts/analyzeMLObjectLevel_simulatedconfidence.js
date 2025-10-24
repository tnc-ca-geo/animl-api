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

// --- Specificity Addition: Add 'specificity' to report columns if not present ---
// --- FPR Addition: Add 'fpr' to report columns if not present ---
// (No longer needed, handled in analysisConfig.js)
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

const { ANALYSIS_DIR, PROJECT_ID, START_DATE, END_DATE, ML_MODEL } = analysisConfig;

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
// --- Confidence Threshold Simulation Addition ---
// Set this value to mimic different MegaDetector confidence thresholds (0 to 1)
const CONFIDENCE_THRESHOLD = 0.8; // Change as needed for experiments

// Helper to get simulated confidence for a label (replace with real value if available)
function getSimulatedConfidence(label) {
  // If your label has a real confidence property, use it here (e.g., label.confidence)
  // For simulation, assign a random confidence between 0.3 and 1.0
  return label.confidence !== undefined ? label.confidence : (Math.random() * 0.7 + 0.3);
}
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

  // --- Confidence Threshold Simulation Addition ---
  // Add threshold to output file name for clarity
  // Format threshold string to only include digits after the decimal point (e.g., 0.9 -> C-9, 0.85 -> C-85)
  const threshStr = `C-${String(CONFIDENCE_THRESHOLD).split('.')[1] || '0'}`;
  const root = `${PROJECT_ID}_${ML_MODEL}_${START_DATE}--${END_DATE}_object-level_${threshStr}_${dt}`;
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
          if (obj.locked && FVLValidatesPrediction(obj, tClass)) {
            data[key].allActuals++;
          }

          // TRUE POSITIVE - object must be:
            const mlLabelsAboveThreshold = obj.labels.filter(
              (l) => l.type === 'ml' && l.mlModel === ML_MODEL && getSimulatedConfidence(l) >= CONFIDENCE_THRESHOLD
            );
            if (
              obj.locked &&
              mlLabelsAboveThreshold.some(
                (l) => l.labelId === tClass.predicted_id,
              ) &&
              FVLValidatesPrediction(obj, tClass)
            ) {
              data[key].truePositives++;
            }

          // FALSE POSITIVE - object must be:
            if (
              obj.locked &&
              mlLabelsAboveThreshold.some(
                (l) => l.labelId === tClass.predicted_id,
              ) &&
              !FVLValidatesPrediction(obj, tClass)
            ) {
              data[key].falsePositives++;
            }

          // FALSE NEGATIVE - object must be:
            if (
              obj.locked &&
              FVLValidatesPrediction(obj, tClass) &&
              !mlLabelsAboveThreshold.some(
                (l) => l.labelId === tClass.predicted_id,
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
      // calculate precision, recall, F1 score, and specificity
      const TP = value.truePositives;
      const FP = value.falsePositives;
      const FN = value.falseNegatives;
      const precision = TP / (TP + FP);
      const recall = TP / (TP + FN);
      const f1 = (2 * precision * recall) / (precision + recall); // harmonic mean


      // --- Specificity & FPR Addition ---
      // Specificity = TN / (TN + FP)
      // FPR = FP / (FP + TN) = 1 - Specificity
      // TN (True Negatives) is the count of all objects that are NOT of this class and were NOT predicted as this class
      // For each row, TN = sum of allActuals for all other classes (excluding this class)
      const TN = Object.values(data)
        .filter((v) => v !== value && v.deploymentName === value.deploymentName)
        .reduce((acc, v) => acc + v.allActuals, 0);
      const specificity = TN + FP > 0 ? TN / (TN + FP) : null;
      const fpr = TN + FP > 0 ? FP / (TN + FP) : null;
      // --- End Specificity & FPR Addition ---

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
  // --- Specificity & FPR Addition ---
  specificity: specificity !== null ? Number.parseFloat(specificity * 100).toFixed(2) : '',
  fpr: fpr !== null ? Number.parseFloat(fpr * 100).toFixed(2) : '',
  // --- End Specificity & FPR Addition ---
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


      // --- Specificity & FPR Addition for Totals ---
      // For totals, TN = sum of allActuals for all other classes (excluding this class, across all deployments)
      const TN_total = Object.values(data)
        .filter((v) => v.targetClass !== tClass.predicted_name)
        .reduce((acc, v) => acc + v.allActuals, 0);
      const specificity_total = TN_total + totalFP > 0 ? TN_total / (TN_total + totalFP) : null;
      const fpr_total = TN_total + totalFP > 0 ? totalFP / (TN_total + totalFP) : null;
      // --- End Specificity & FPR Addition for Totals ---

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
  // --- Specificity & FPR Addition ---
  specificity: specificity_total !== null ? Number.parseFloat(specificity_total * 100).toFixed(2) : '',
  fpr: fpr_total !== null ? Number.parseFloat(fpr_total * 100).toFixed(2) : '',
  // --- End Specificity & FPR Addition ---
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
