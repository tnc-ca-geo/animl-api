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
import { analysisConfig, reportColumns } from './analysisConfig.js';
import Image from '../../.build/api/db/schemas/Image.js';
import { ProjectModel } from '../../.build/api/db/models/Project.js';

const getMlLabels = async (projectId, modelId) => {
  // Hard code this classifier
  // return [
  //   {
  //     name: "rattus species",
  //     labelId: "00049ff0-2ffa-4d82-8cf3-c861fbbfa9d5",
  //     taxonomicChildren: [],
  //   },
  //   {
  //     name: "rodent",
  //     labelId: "90d950db-2106-4bd9-a4c1-777604c3eada",
  //     taxonomicChildren: [],
  //   },
  //   {
  //     name: "muridae family",
  //     labelId: "9880b662-dc21-453b-aa2f-dd97338f623b",
  //     taxonomicChildren: [],
  //   },
  // ]
  //
  //

  const project = await Project.findOne({
    _id: projectId
  });

  console.log('fetching model labels...');
  const model = await MLModel.findOne({
    _id: modelId
  });

  return model.categories.reduce((acc, cat) => {
    const projectLabel = project.labels.find((lbl) => lbl.name === cat.name);
    if (!projectLabel) {
      return acc;
    }

    if (!cat.taxonomy) {
      console.log("why we always failing here", cat.taxonomy)
      return acc;
      throw new Error("Label missing taxonomoy");
    }

    const taxnomicLevels = cat.taxonomy.split(';');
    // const labelTaxonomicIdx = taxnomicLevels.indexOf(category.name);
    const taxonomicChildren = taxnomicLevels
      .reduce((children, taxonomicChild) => {
        const projectLabel = project.labels.find((lbl) => lbl.name === taxonomicChild);
        if (projectLabel) {
          children.push({ name: taxonomicChild, labelId: projectLabel._id });
        }
        return children;
      }, [])

    acc.push({
      name: cat.name,
      labelId: projectLabel._id,
      taxonomicChildren: taxonomicChildren
    });

    console.log("acc", acc)

    return acc;
  }, []);
}

const { ANALYSIS_DIR, PROJECT_ID, START_DATE, END_DATE, ML_MODEL } = analysisConfig;
  const config = await getConfig();
  console.log('Connecting to db...');
  const dbClient = await connectToDatabase(config);


const res = await getMlLabels(PROJECT_ID, ML_MODEL);
console.log("res", res);
    dbClient.connection.close();
//
// async function writeConfigToFile(filename, analysisPath, config) {
//   const jsonFilename = path.join(analysisPath, `${filename}_config.json`);
//
//   if (!fs.existsSync(analysisPath)) {
//     fs.mkdirSync(analysisPath, { recursive: true });
//   }
//
//   try {
//     const data = JSON.stringify(config, null, 2);
//     fs.writeFileSync(jsonFilename, data, 'utf8');
//   } catch (err) {
//     throw console.log(err instanceof Error ? err.message : String(err));
//   }
// }
//
// const buildBasePipeline = (projectId, startDate, endDate) => [
//   // return reviewed images for a camera between two dates
//   {
//     $match: {
//       projectId: projectId,
//       dateAdded: {
//         $gte: new Date(startDate),
//         $lt: new Date(endDate),
//       },
//       reviewed: true,
//     },
//   },
//
//   // set the firstValidLabel field
//   {
//     $set: {
//       objects: {
//         $map: {
//           input: '$objects',
//           as: 'obj',
//           in: {
//             $setField: {
//               field: 'firstValidLabel',
//               input: '$$obj',
//               value: {
//                 $filter: {
//                   input: '$$obj.labels',
//                   as: 'label',
//                   cond: {
//                     $eq: ['$$label.validation.validated', true],
//                   },
//                   limit: 1,
//                 },
//               },
//             },
//           },
//         },
//       },
//     },
//   },
// ];
//
// function getDeployment(img, cameraConfigs) {
//   return cameraConfigs
//     .find((cc) => cc._id.toString() === img.cameraId.toString())
//     .deployments.find((dep) => dep._id.toString() === img.deploymentId.toString());
// }
//
// async function getCount(pipeline) {
//   console.log('getting image count');
//   let count = null;
//   try {
//     const pipelineCopy = structuredClone(pipeline);
//     pipelineCopy.push({ $count: 'count' });
//     // console.log('pipelineCopy: ', JSON.stringify(pipelineCopy, null, 2));
//     const res = await Image.aggregate(pipelineCopy);
//     count = res[0] ? res[0].count : 0;
//   } catch (err) {
//     console.log('error counting Image: ', err);
//   }
//   return count;
// }
//
// function FVLValidatesPrediction(obj, mlLabel) {
//   // if no firstValidLabel, all labels have been invalidated, so return false
//   if (obj.firstValidLabel.length === 0) return false;
//   const fvl = obj.firstValidLabel[0]?.labelId;
//   // if the ml model is megadetector and the target class is '1' (animal),
//   // any firstValidLabel that is not is a person or vehicle or 'empty'
//   // would validate the prediction
//   if (ML_MODEL.includes('megadetector') && tClass.predicted_id === '1') {
//     return fvl !== '2' && fvl !== '3' && fvl !== 'empty';
//   } else {
//     const taxnomicChildrenIds = mlLabel.taxonomicChildren.map((child) => child.labelId);
//     return mlLabel === fvl || taxnomicChildrenIds.includes(fvl);
//   }
// }
//
// // main function
// async function analyze() {
//   console.log(
//     `Analyzing ${ML_MODEL} performance in ${PROJECT_ID} Project between ${START_DATE} and ${END_DATE}...`,
//   );
//   console.log('Getting config...');
//   const config = await getConfig();
//   console.log('Connecting to db...');
//   const dbClient = await connectToDatabase(config);
//
//   const mlLabels = await getMlLabels(PROJECT_ID, ML_MODEL);
//
//   try {
//     // set up data structure to hold results
//     const project = await ProjectModel.queryById(PROJECT_ID);
//     const cameraConfigs = project.cameraConfigs;
//     const data = {};
//     cameraConfigs.forEach((cc) => {
//       for (const dep of cc.deployments) {
//         if (dep.name === 'default') continue; // skip default deployments
//         for (const mlLabel of mlLabels) {
//           data[`${dep._id}_${mlLabel.labelId}`] = {
//             cameraId: cc._id,
//             deploymentName: dep.name,
//             targetClass: mlLabel.labelId,
//             validationClasses: tClass.taxonomicChildren.join(', '),
//             allActuals: 0,
//             truePositives: 0,
//             falsePositives: 0,
//             falseNegatives: 0,
//             precision: null,
//             recall: null,
//             f1: null,
//           };
//         }
//       }
//     });
//
//     // init reports
//     const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
//     const analysisPath = path.join(appRoot.path, ANALYSIS_DIR);
//     if (!fs.existsSync(analysisPath)) {
//       fs.mkdirSync(analysisPath, { recursive: true });
//     }
//
//     const root = `${PROJECT_ID}_${ML_MODEL}_${START_DATE}--${END_DATE}_object-level_${dt}`;
//     await writeConfigToFile(root, analysisPath, analysisConfig);
//
//     const csvFilename = path.join(analysisPath, `${root}.csv`);
//     const writableStream = fs.createWriteStream(csvFilename);
//     const stringifier = stringify({ header: true, columns: reportColumns });
//     stringifier.on('error', (err) => console.error(err.message));
//
//     // stream in images from MongoDB
//     const aggPipeline = buildBasePipeline(PROJECT_ID, START_DATE, END_DATE);
//     const imgCount = await getCount(aggPipeline);
//     console.log('image count: ', imgCount);
//     const progress = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
//     progress.start(imgCount, 0);
//
//     for await (const img of Image.aggregate(aggPipeline)) {
//       // skip default deployments
//       const imgDep = getDeployment(img, cameraConfigs);
//       if (imgDep.name === 'default') continue;
//
//       // iterate over objects and count up TPs, FPs, and FNs for all target classes
//       for (const obj of img.objects) {
//         for (const mlLabel of mlLabels) {
//           const key = `${imgDep._id}_${mlLabel.labelId}`;
//
//           // ACTUAL - object must be:
//           // (a) locked, (b) has a first valid label that validates the prediction/target class,
//           // (i.e., for "rodent" prediction, a firstValidLabel of "rodent" or any of its taxonomic children),
//           if (obj.locked && FVLValidatesPrediction(obj, mlLabel)) {
//             data[key].allActuals++;
//             // console.log(
//             //   `actual ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
//             // );
//           }
//
//           // TRUE POSITIVE - object must be:
//           // (a) locked, (b) has an ml-predicted label of the target class, and
//           // (c) has a first valid label that validates the prediction/target class,
//           // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
//           if (
//             obj.locked &&
//             obj.labels.some(
//               (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === mlLabel.labelId,
//             ) &&
//             FVLValidatesPrediction(obj, mlLabel)
//           ) {
//             data[key].truePositives++;
//             // console.log(
//             //   `TP ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
//             // );
//           }
//
//           // FALSE POSITIVE - object must be:
//           // (a) locked, (b) has an ml-predicted label of the target class, and
//           // (c) DOES NOT have a first valid label that validates the prediction/target class
//           if (
//             obj.locked &&
//             obj.labels.some(
//               (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === mlLabel.labelId,
//             ) &&
//             !FVLValidatesPrediction(obj, mlLabel)
//           ) {
//             data[key].falsePositives++;
//             // console.log(
//             //   `FP ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
//             // );
//           }
//
//           // FALSE NEGATIVE - object must be:
//           // (a) locked, (b) has a first valid label that validates the prediction/target class,
//           // (i.e., for "rodent" prediction, a firstValidLabel of ["rodent", "mouse, "rat"]),
//           // and (c) does NOT have an ml-predicted label of the target class
//           if (
//             obj.locked &&
//             FVLValidatesPrediction(obj, mlLabel) &&
//             !obj.labels.some(
//               (l) => l.type === 'ml' && l.mlModel === ML_MODEL && l.labelId === mlLabel.labelId,
//             )
//           ) {
//             data[key].falseNegatives++;
//             // console.log(
//             //   `FN ${tClass.predicted_id} on image ${img._id}: ${JSON.stringify(obj, null, 2)}`,
//             // );
//           }
//         }
//       }
//
//       progress.increment();
//     }
//
//     progress.stop();
//     console.log(`\nAnalysis complete. Writing results to ${csvFilename}`);
//
//     // write results to csv
//     for (const value of Object.values(data)) {
//       // calculate precision, recall, and F1 score
//       const TP = value.truePositives;
//       const FP = value.falsePositives;
//       const FN = value.falseNegatives;
//       const precision = TP / (TP + FP);
//       const recall = TP / (TP + FN);
//       const f1 = (2 * precision * recall) / (precision + recall); // harmonic mean
//
//       // write row to csv
//       stringifier.write({
//         ...value,
//         allActuals: value.allActuals,
//         truePositives: TP,
//         falsePositives: FP,
//         falseNegatives: FN,
//         precision: Number.parseFloat(precision * 100).toFixed(2),
//         recall: Number.parseFloat(recall * 100).toFixed(2),
//         f1: Number.parseFloat(f1).toFixed(2),
//       });
//     }
//
//     // add rows for target class totals
//     for (const mlLabel of mlLabels) {
//       const mlLabelRows = Object.values(data).filter((v) => v.targetClass === mlLabel.name);
//
//       const totalActuals = mlLabelRows.reduce((acc, v) => acc + v.allActuals, 0);
//       const totalTP = mlLabelRows.reduce((acc, v) => acc + v.truePositives, 0);
//       const totalFP = mlLabelRows.reduce((acc, v) => acc + v.falsePositives, 0);
//       const totalFN = mlLabelRows.reduce((acc, v) => acc + v.falseNegatives, 0);
//       const precision = totalTP / (totalTP + totalFP);
//       const recall = totalTP / (totalTP + totalFN);
//       const f1 = (2 * precision * recall) / (precision + recall);
//
//       // write row to csv
//       stringifier.write({
//         cameraId: 'total',
//         deploymentName: 'total',
//         targetClass: mlLabel.name,
//         validationClasses: mlLabel.taxnomicChildren.join(', '),
//         allActuals: totalActuals,
//         truePositives: totalTP,
//         falsePositives: totalFP,
//         falseNegatives: totalFN,
//         precision: Number.parseFloat(precision * 100).toFixed(2),
//         recall: Number.parseFloat(recall * 100).toFixed(2),
//         f1: Number.parseFloat(f1).toFixed(2),
//       });
//     }
//     stringifier.end();
//
//     await stream.pipeline(stringifier, writableStream);
//
//     dbClient.connection.close();
//     process.exit(0);
//   } catch (err) {
//     dbClient.connection.close();
//     console.log(err);
//   }
// }
//
// analyze();
