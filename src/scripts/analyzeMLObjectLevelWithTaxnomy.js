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

// The taxonomy field from speciesnet only shows ancestors
// This adds each speciesnet label used in the project to
// the child set of it's ancestors
const buildLocalTree = (project, model) => {
  const tree = {};
  for (const projectLabel of project.labels) {
    const mlCategory = model.categories.find((category) => category.name === projectLabel.name);
    if (!mlCategory || !mlCategory.taxonomy) {
      continue;
    }

    const taxonomicAncestors = mlCategory.taxonomy.split(';').filter((ancestor) => ancestor !== '');

    for (const taxonomicAncestor of taxonomicAncestors) {
      const children = tree[taxonomicAncestor] ?? new Set();
      tree[taxonomicAncestor] = new Set([...children, mlCategory.name]);
    }
  }

  return tree;
};

// Returns a custom label object which includes the label ID, name, and
// taxonomic child set.
// { name: string, labelId: string, taxonomicChildren: [label name] }
const getMlLabels = (project, model, localTree) => {
  const modelLabels = [];
  for (const projectLabel of project.labels) {
    const mlCategory = model.categories.find((category) => category.name === projectLabel.name);
    if (!mlCategory || !mlCategory.taxonomy) {
      continue;
    }

    const taxonomicName = mlCategory.taxonomy.split(';').filter((ancestor) => ancestor !== '').pop();
    const taxonomicChildren = localTree[mlCategory.name] ?? localTree[taxonomicName] ?? new Set();
    const taxonomicChildrenIds = Array.from(taxonomicChildren).reduce((acc, taxonomicName) => {
      const projectLabelForChild = project.labels.find((lbl) => lbl.name === taxonomicName);
      return [...acc, taxonomicName, projectLabelForChild._id];
    }, []);

    modelLabels.push({
      name: mlCategory.name,
      labelId: projectLabel._id,
      taxonomicChildren: taxonomicChildrenIds
    });
  }

  return modelLabels;
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

const getDeployment = (img, cameraConfigs) => {
  return cameraConfigs
    .find((cc) => cc._id.toString() === img.cameraId.toString())
    .deployments
    .find((dep) => dep._id.toString() === img.deploymentId.toString());
};

const getCount = async (pipeline) => {
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
};

const setupResultsStructure = (project, mlLabels) => {
  const cameraConfigs = project.cameraConfigs;
  const data = {};
  cameraConfigs.forEach((cc) => {
    for (const dep of cc.deployments) {
      // if (dep.name === 'default') continue; // skip default deployments
      for (const mlLabel of mlLabels) {
        data[`${dep._id}_${mlLabel.name}`] = {
          cameraId: cc._id,
          deploymentName: dep.name,
          targetClass: `${mlLabel.name}:${mlLabel.labelId}`,
          validationClasses: mlLabel.taxonomicChildren.join(', '),
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
    const mlLabelRows = Object.values(stats).filter((v) => v.targetClass === mlLabel.name);

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
      targetClass: mlLabel.name,
      validationClasses: mlLabel.taxonomicChildren.join(', '),
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

const FVLValidatesPrediction = (obj, mlLabel, mlModel) => {
  // if no firstValidLabel, all labels have been invalidated, so return false
  if (obj.firstValidLabel.length === 0) return false;
  const fvl = obj.firstValidLabel[0]?.labelId;
  // if the ml model is megadetector and the target class is '1' (animal),
  // any firstValidLabel that is not is a person or vehicle or 'empty'
  // would validate the prediction
  if (mlModel.includes('megadetector') && mlLabel.labelId === '1') {
    return fvl !== '2' && fvl !== '3' && fvl !== 'empty';
  } else {
    return mlLabel.name === fvl || mlLabel.labelId === fvl || mlLabel.taxonomicChildren.includes(fvl);
  }
};

const analyze = async (analysisConfig) => {
  const { ANALYSIS_DIR, PROJECT_ID, START_DATE, END_DATE, ML_MODEL } = analysisConfig;

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
    const localTree = buildLocalTree(project, model);
    const mlLabels = getMlLabels(project, model, localTree);

    console.log('Setting up results structure...');
    const data = setupResultsStructure(project, mlLabels);

    // analyze loop
    const aggPipeline = buildBasePipeline(PROJECT_ID, START_DATE, END_DATE);
    const imgCount = await getCount(aggPipeline);
    console.log(`Starting analysis on: ${imgCount} images...`);

    const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progress.start(imgCount, 0);

    for await (const img of Image.aggregate(aggPipeline)) {
      const imgDep = getDeployment(img, project.cameraConfigs);
      // if (imgDep.name === 'default') continue;

      // iterate over objects and count up TPs, FPs, and FNs for all target classes
      for (const obj of img.objects) {
        for (const mlLabel of mlLabels) {
          const key = `${imgDep._id}_${mlLabel.name}`;

          const objectLabelsHaveTargetLabel = obj.labels.some((label) => (
            label.type === 'ml' &&
            label.mlModel === ML_MODEL &&
            (label.labelId === mlLabel.labelId || label.labelId === mlLabel.name)
          ));

          const fvlValidatesPrediction = FVLValidatesPrediction(obj, mlLabel, ML_MODEL);

          // ACTUAL - object must be:
          // (a) locked, (b) has a first valid label that validates the prediction/target class,
          // (i.e., for "rodent" prediction, a firstValidLabel of "rodent" or any of its taxonomic children),
          if (obj.locked && fvlValidatesPrediction) {
            data[key].allActuals++;
          }

          // TRUE POSITIVE - object must be:
          // (a) locked, (b) has an ml-predicted label of the target class, and
          // (c) has a first valid label that validates the prediction/target class,
          // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
          if (
            obj.locked &&
            objectLabelsHaveTargetLabel &&
            fvlValidatesPrediction
          ) {
            data[key].truePositives++;
          }

          // FALSE POSITIVE - object must be:
          // (a) locked, (b) has an ml-predicted label of the target class, and
          // (c) DOES NOT have a first valid label that validates the prediction/target class
          if (
            obj.locked &&
            objectLabelsHaveTargetLabel &&
            !fvlValidatesPrediction
          ) {
            data[key].falsePositives++;
          }

          // FALSE NEGATIVE - object must be:
          // (a) locked, (b) has a first valid label that validates the prediction/target class,
          // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
          // and (c) does NOT have an ml-predicted label of the target class
          if (
            obj.locked &&
            fvlValidatesPrediction &&
            !objectLabelsHaveTargetLabel
          ) {
            data[key].falseNegatives++;
          }
        }
      }

      progress.increment();
    }

    progress.stop();

    console.log('Calculating stats...');
    const stats = calculateStats(data);
    console.log('Summing totals...');
    const totals = calculateTotals(stats, mlLabels);

    console.log('Writing results to file...');
    await writeToFile(stats, totals, ANALYSIS_DIR, PROJECT_ID, ML_MODEL, START_DATE, END_DATE, analysisConfig);

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    dbClient.connection.close();
    console.log(err);
  }
};

analyze(CONFIG);
