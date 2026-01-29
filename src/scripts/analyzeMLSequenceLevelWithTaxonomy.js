/*
 * Script to analyze ML model performance at the sequence (bursts of images) level with taxonomy support
 *
 * This script evaluates ML model accuracy by grouping chronologically adjacent images into sequences
 * and treating each sequence as a single classification unit. Unlike object-level analysis, if ANY
 * image in a sequence contains the target class, the entire sequence counts as one positive.
 *
 * Key features:
 * - Supports taxonomic validation (e.g., "rodent" predictions validated by "mouse", "rat", etc.)
 * - Works with both MegaDetector and SpeciesNet models
 * - Groups images into sequences based on configurable time gaps
 * - Generates precision, recall, and F1 scores per deployment and target class
 *
 * Prerequisites:
 * - Images must be reviewed (locked) to be included in analysis
 * - Model must have been used consistently during the specified date range
 * - Configuration must be set in analysisConfig.js
 *
 * Command to run:
 * STAGE=prod AWS_PROFILE=animl REGION=us-west-2 node ./src/scripts/analyzeMLSequenceLevelWithTaxonomy.js
 */

import Project from '../../.build/api/db/schemas/Project.js';
import MLModel from '../../.build/api/db/schemas/MLModel.js';
import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream/promises';
import { DateTime } from 'luxon';
import appRoot from 'app-root-path';
import { stringify } from 'csv-stringify';
import cliProgress from 'cli-progress';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';
import { analysisConfig as CONFIG, reportColumns } from './analysisConfig.js';
import Image from '../../.build/api/db/schemas/Image.js';

// Build taxonomic descendant sets from project labels and model taxonomy
// Creates mapping where each ancestor taxon points to all its descendant species in the project
const buildTaxonomicDescendentSets = (project, model) => {
  const taxonomicDescendents = {};
  for (const projectLabel of project.labels) {
    const mlCategory = model.categories.find((category) => category.name === projectLabel.name);
    if (!mlCategory || !mlCategory.taxonomy) {
      continue;
    }

    const taxonomicAncestors = mlCategory.taxonomy
      .split(';')
      .filter((taxon) => taxon !== '' && taxon !== mlCategory.name);

    for (const taxon of taxonomicAncestors) {
      const descendents = taxonomicDescendents[taxon] ?? new Set();
      taxonomicDescendents[taxon] = new Set([...descendents, mlCategory.name]);
    }
  }

  return taxonomicDescendents;
};

// Create target classes with their taxonomic descendants for validation
// Enables validating predictions against both exact matches and taxonomically related species
const enrichTaxonomicDescendentSets = (project, model, taxonomicDescendentSets) => {
  const enrichedTaxonomicDescendentSets = [];
  for (const projectLabel of project.labels) {
    const mlCategory = model.categories.find((category) => category.name === projectLabel.name);
    if (!mlCategory || !mlCategory.taxonomy) {
      continue;
    }

    const taxonomicName = mlCategory.taxonomy.split(';').filter((ancestor) => ancestor !== '').pop();
    const descendentTaxa = taxonomicDescendentSets[mlCategory.name] ?? taxonomicDescendentSets[taxonomicName] ?? new Set();
    const descendentTaxaIds = Array.from(descendentTaxa).reduce((acc, taxonomicName) => {
      const projectLabelForDescendentTaxon = project.labels.find((lbl) => lbl.name === taxonomicName);
      return [...acc, `${taxonomicName}:${projectLabelForDescendentTaxon._id}`];
    }, []);

    enrichedTaxonomicDescendentSets.push({
      targetClass: `${mlCategory.name}:${projectLabel._id}`,
      taxonomicDescendentClasses: descendentTaxaIds
    });
  }

  return enrichedTaxonomicDescendentSets;
};

const writeConfigToFile = async (filename, analysisPath, config) => {
  const jsonFilename = path.join(analysisPath, `${filename}_config.json`);

  if (!fs.existsSync(analysisPath)) {
    fs.mkdirSync(analysisPath, { recursive: true });
  }

  try {
    const data = JSON.stringify(config, null, 2);
    fs.writeFileSync(jsonFilename, data, 'utf8');
  } catch (err) {
    throw console.log(err instanceof Error ? err.message : String(err));
  }
};

const buildBasePipeline = (projectId, startDate, endDate) => [
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

const getCount = async (pipeline) => {
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
};

const setupResultsStructure = (project, mlLabels) => {
  const cameraConfigs = project.cameraConfigs;
  const data = {};
  cameraConfigs.forEach((cc) => {
    for (const dep of cc.deployments) {
      if (SKIP_DEFAULT_DEPLOYMENT && dep.name === 'default') {
        continue; // skip default deployments
      }
      for (const mlLabel of mlLabels) {
        const [mlLabelName, mlLabelId] = mlLabel.targetClass.split(':');
        data[`${dep._id}_${mlLabelName}`] = {
          cameraId: cc._id,
          deploymentName: dep.name,
          targetClass: `${mlLabelName}:${mlLabelId}`,
          validationClasses: mlLabel.taxonomicDescendentClasses.join(', '),
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

  return data;
};

const calculateStats = (data) => {
  return Object.values(data).map((value) => {
    const TP = value.truePositives;
    const FP = value.falsePositives;
    const FN = value.falseNegatives;
    const precision = TP / (TP + FP);
    const recall = TP / (TP + FN);
    const f1 = (2 * precision * recall) / (precision + recall); // harmonic mean

    return {
      ...value,
      allActuals: value.allActuals,
      truePositives: TP,
      falsePositives: FP,
      falseNegatives: FN,
      precision: Number.parseFloat(precision * 100).toFixed(2),
      recall: Number.parseFloat(recall * 100).toFixed(2),
      f1: Number.parseFloat(f1).toFixed(2),
    };
  });
};

const calculateTotals = (stats, mlLabels) => {
  return mlLabels.map((mlLabel) => {
    const mlLabelRows = Object.values(stats).filter((v) => v.targetClass === mlLabel.targetClass);

    const totalActuals = mlLabelRows.reduce((acc, v) => acc + v.allActuals, 0);
    const totalTP = mlLabelRows.reduce((acc, v) => acc + v.truePositives, 0);
    const totalFP = mlLabelRows.reduce((acc, v) => acc + v.falsePositives, 0);
    const totalFN = mlLabelRows.reduce((acc, v) => acc + v.falseNegatives, 0);
    const precision = totalTP / (totalTP + totalFP);
    const recall = totalTP / (totalTP + totalFN);
    const f1 = (2 * precision * recall) / (precision + recall);

    return {
      cameraId: 'total',
      deploymentName: 'total',
      targetClass: mlLabel.targetClass,
      validationClasses: mlLabel.taxonomicDescendentClasses.join(', '),
      allActuals: totalActuals,
      truePositives: totalTP,
      falsePositives: totalFP,
      falseNegatives: totalFN,
      precision: Number.parseFloat(precision * 100).toFixed(2),
      recall: Number.parseFloat(recall * 100).toFixed(2),
      f1: Number.parseFloat(f1).toFixed(2),
    };
  });
};

const writeToFile = async (stats, totals, analysisDir, projectId, mlModel, startDate, endDate, analysisConfig) => {
  // init reports
  const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
  const analysisPath = path.join(appRoot.path, analysisDir);
  if (!fs.existsSync(analysisPath)) {
    fs.mkdirSync(analysisPath, { recursive: true });
  }

  const root = `${projectId}_${mlModel}_${startDate}--${endDate}_object-level_${dt}`;
  await writeConfigToFile(root, analysisPath, analysisConfig);

  const csvFilename = path.join(analysisPath, `${root}.csv`);
  const writableStream = fs.createWriteStream(csvFilename);
  const stringifier = stringify({ header: true, columns: reportColumns });
  stringifier.on('error', (err) => console.error(err.message));

  // write results to csv
  for (const value of Object.values(stats)) {
    stringifier.write(value);
  }

  // write totals to csv
  for (const value of totals) {
    stringifier.write(value);
  }

  stringifier.end();
  await stream.pipeline(stringifier, writableStream);
};

// Generate sequences by grouping chronologically adjacent images within time threshold
// Returns structured sequences with metadata for easier processing and debugging
const generateSequencesForDeployment = async (deployment, basePipeline, maxSequenceDelta) => {
  const depPipeline = structuredClone(basePipeline);
  depPipeline[0].$match.deploymentId = deployment._id;
  depPipeline.push({ $sort: { dateTimeAdjusted: 1 } });

  const sequences = [];
  let currentSequence = [];

  for await (const img of Image.aggregate(depPipeline)) {
    if (currentSequence.length === 0) {
      currentSequence.push(img);
      continue;
    }

    const lastImg = currentSequence[currentSequence.length - 1];
    const imgDateTime = DateTime.fromJSDate(img.dateTimeAdjusted);
    const lastImgDateTime = DateTime.fromJSDate(lastImg.dateTimeAdjusted);
    const deltaSeconds = Math.abs(lastImgDateTime.diff(imgDateTime, 'seconds').seconds);

    if (deltaSeconds <= maxSequenceDelta) {
      currentSequence.push(img);
    } else {
      // Gap found - save current sequence and start new one
      sequences.push({
        images: [...currentSequence],
        startTime: DateTime.fromJSDate(currentSequence[0].dateTimeAdjusted),
        endTime: DateTime.fromJSDate(currentSequence[currentSequence.length - 1].dateTimeAdjusted),
        imageCount: currentSequence.length
      });
      currentSequence = [img];
    }
  }

  // Don't forget the final sequence
  if (currentSequence.length > 0) {
    sequences.push({
      images: [...currentSequence],
      startTime: DateTime.fromJSDate(currentSequence[0].dateTimeAdjusted),
      endTime: DateTime.fromJSDate(currentSequence[currentSequence.length - 1].dateTimeAdjusted),
      imageCount: currentSequence.length
    });
  }

  return sequences;
};

// Determine if human validation supports the ML prediction, considering taxonomy
// Handles special MegaDetector logic and taxonomic relationships for SpeciesNet
const FVLValidatesPrediction = (obj, mlLabel, mlModel) => {
  // if no firstValidLabel, all labels have been invalidated, so return false
  if (obj.firstValidLabel.length === 0) return false;
  const fvl = obj.firstValidLabel[0]?.labelId;
  // if the ml model is megadetector and the target class is '1' (animal),
  // any firstValidLabel that is not is a person or vehicle or 'empty'
  // would validate the prediction
  const [mlLabelName, mlLabelId] = mlLabel.targetClass.split(':');
  const descendentTaxaIdsAndNames = mlLabel.taxonomicDescendentClasses.map((taxon) => taxon.split(':')).flat();
  if (mlModel.includes('megadetector') && mlLabelId === '1') {
    return fvl !== '2' && fvl !== '3' && fvl !== 'empty';
  } else {
    return mlLabelName === fvl || mlLabelId === fvl || descendentTaxaIdsAndNames.includes(fvl);
  }
};

// Check if object represents ground truth positive for target class
const isActual = (obj, mlLabel, mlModel) =>
  obj.locked && FVLValidatesPrediction(obj, mlLabel, mlModel);

// Check if ML correctly predicted target class (considering taxonomic descendants)
const isTruePositive = (obj, mlLabel, mlModel) => {
  const [targetClassName, targetClassId] = mlLabel.targetClass.split(':');
  const descendentTaxaIds = mlLabel.taxonomicDescendentClasses.map((idNamePair) => idNamePair.split(':')).flat();

  const objectLabelsHaveTargetOrDescendentClass = obj.labels.some((label) => (
    label.type === 'ml' &&
    label.mlModel === mlModel &&
    (label.labelId === targetClassId || label.labelId === targetClassName || descendentTaxaIds.includes(label.labelId))
  ));

  return obj.locked &&
         objectLabelsHaveTargetOrDescendentClass &&
         FVLValidatesPrediction(obj, mlLabel, mlModel);
};

// Check if ML incorrectly predicted target class (prediction exists but validation fails)
const isFalsePositive = (obj, mlLabel, mlModel) => {
  const [targetClassName, targetClassId] = mlLabel.targetClass.split(':');
  const descendentTaxaIds = mlLabel.taxonomicDescendentClasses.map((idNamePair) => idNamePair.split(':')).flat();

  const objectLabelsHaveTargetOrDescendentClass = obj.labels.some((label) => (
    label.type === 'ml' &&
    label.mlModel === mlModel &&
    (label.labelId === targetClassId || label.labelId === targetClassName || descendentTaxaIds.includes(label.labelId))
  ));

  return obj.locked &&
         objectLabelsHaveTargetOrDescendentClass &&
         !FVLValidatesPrediction(obj, mlLabel, mlModel);
};

// Analyze entire sequence as atomic unit - if ANY image contains target class, whole sequence counts
// Uses boolean flags to ensure sequence-level (not image-level) counting
const processSequence = (sequence, deployment, data, mlLabels, mlModel) => {
  for (const mlLabel of mlLabels) {
    const [mlLabelName] = mlLabel.targetClass.split(':');
    const key = `${deployment._id}_${mlLabelName}`;

    let hasActual = false;
    let hasTruePositive = false;
    let hasFalsePositive = false;

    for (const img of sequence.images) {
      for (const obj of img.objects) {
        if (!hasActual) {
          hasActual = isActual(obj, mlLabel, mlModel);
        }

        if (!hasTruePositive) {
          hasTruePositive = isTruePositive(obj, mlLabel, mlModel);
        }

        if (!hasFalsePositive) {
          hasFalsePositive = isFalsePositive(obj, mlLabel, mlModel);
        }
      }
    }

    if (hasActual) data[key].allActuals++;
    if (hasTruePositive) data[key].truePositives++;
    if (hasActual && !hasTruePositive) data[key].falseNegatives++;
    if (!hasActual && hasFalsePositive) data[key].falsePositives++;
  }

  return data;
};

const analyze = async (analysisConfig) => {
  const { ANALYSIS_DIR, PROJECT_ID, START_DATE, END_DATE, ML_MODEL, MAX_SEQUENCE_DELTA } = analysisConfig;

  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);

  try {
    console.log('Getting project...');
    const project = await Project.findOne({
      _id: PROJECT_ID
    });

    console.log('Getting model...');
    const model = await MLModel.findOne({
      _id: ML_MODEL
    });

    console.log('Getting model labels...');
    const taxonomicDescendentSets = buildTaxonomicDescendentSets(project, model);
    const enrichedTaxonomicDescendentSets = enrichTaxonomicDescendentSets(project, model, taxonomicDescendentSets);

    console.log('Setting up results structure...');
    let data = setupResultsStructure(project, enrichedTaxonomicDescendentSets);

    const aggPipeline = buildBasePipeline(PROJECT_ID, START_DATE, END_DATE);
    console.log('Counting images...');
    const imgCount = await getCount(aggPipeline);
    console.log(`Starting analysis on ${imgCount} images...`);

    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(imgCount, 0);

    // Get deployments
    const deployments = [];
    project.cameraConfigs.forEach((cc) => {
      for (const dep of cc.deployments) {
        if (SKIP_DEFAULT_DEPLOYMENT && dep.name === 'default') {
          continue;
        }
        deployments.push(dep);
      }
    });

    for (const dep of deployments) {
      console.log(`Processing deployment: ${dep.name}`);
      const sequences = await generateSequencesForDeployment(dep, aggPipeline, MAX_SEQUENCE_DELTA);
      console.log(`Found ${sequences.length} sequences`);

      for (const sequence of sequences) {
        data = processSequence(sequence, dep, data, enrichedTaxonomicDescendentSets, ML_MODEL);
        progress.increment(sequence.imageCount);
      }
    }

    progress.stop();

    console.log('Calculating stats...');
    const stats = calculateStats(data);
    console.log('Summing totals...');
    const totals = calculateTotals(stats, enrichedTaxonomicDescendentSets);

    console.log('Writing results to file...');
    await writeToFile(stats, totals, ANALYSIS_DIR, PROJECT_ID, ML_MODEL, START_DATE, END_DATE, analysisConfig);

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    console.log(err);
  }
};

// Export functions for testing
export { processSequence, isActual, isTruePositive, isFalsePositive };

// Only run if this file is executed directly, not when imported
if (import.meta.url === `file://${process.argv[1]}`) {
  // Remove TARGET_CLASSES from config to avoid confusion
  // eslint-disable-next-line no-unused-vars
  const { TARGET_CLASSES, SKIP_DEFAULT_DEPLOYMENT, ...configWithoutTargetClasses } = CONFIG;
  analyze(configWithoutTargetClasses);
}
