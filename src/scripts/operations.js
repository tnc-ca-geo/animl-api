import fs from 'node:fs';
import path from 'node:path';
import appRoot from 'app-root-path';
import Mongoose from 'mongoose';
import { DateTime } from 'luxon';
import fetch from 'node-fetch';
import sharp from 'sharp';
import Image from '../../.build/api/db/schemas/Image.js';
import Project from '../../.build/api/db/schemas/Project.js';
import { getQueryableLabelIds, isImageReviewed } from '../../.build/api/db/models/utils.js';
import { buildImgUrl } from '../../.build/api/db/models/utils.js';
import { backupConfig } from './backupConfig.js';

const ObjectId = Mongoose.Types.ObjectId;

// Pipelines for finding images affected by out-of-order mutation race condition
// See: https://github.com/tnc-ca-geo/animl-api/issues/316

// Case A: Objects that are unlocked but ALL labels have been invalidated
const pipelineCaseA = [
  {
    $match: {
      objects: {
        $elemMatch: {
          locked: false,
          labels: {
            $not: {
              $elemMatch: {
                $or: [{ validation: null }, { 'validation.validated': true }],
              },
            },
          },
        },
      },
    },
  },
];

// Case B: Objects that are unlocked but have at least one validated label
const pipelineCaseB = [
  {
    $match: {
      objects: {
        $elemMatch: {
          locked: false,
          labels: {
            $elemMatch: {
              'validation.validated': true,
            },
          },
        },
      },
    },
  },
];

async function getAffectedImageIds() {
  const [caseAResults, caseBResults] = await Promise.all([
    Image.aggregate([...pipelineCaseA, { $project: { _id: 1, projectId: 1 } }]),
    Image.aggregate([...pipelineCaseB, { $project: { _id: 1, projectId: 1 } }]),
  ]);

  const caseAIds = new Set(caseAResults.map((img) => img._id));
  const caseBIds = new Set(caseBResults.map((img) => img._id));

  // Deduplicate and tag each image with which case(s) it matches
  const allIds = new Map();
  for (const img of caseAResults) {
    allIds.set(img._id, { _id: img._id, projectId: img.projectId, case: 'A' });
  }
  for (const img of caseBResults) {
    const existing = allIds.get(img._id);
    if (existing) {
      existing.case = 'A+B';
    } else {
      allIds.set(img._id, { _id: img._id, projectId: img.projectId, case: 'B' });
    }
  }

  return { entries: [...allIds.values()], ids: [...allIds.keys()] };
}

const pipeline = [
  // {
  //   $match: {
  //     projectId: 'owpge',
  //   },
  // },
  {
    $set: {
      objects: {
        $map: {
          input: '$objects',
          as: 'obj',
          in: {
            $setField: {
              field: 'allValidatedLabels',
              input: '$$obj',
              value: {
                $filter: {
                  input: '$$obj.labels',
                  as: 'label',
                  cond: {
                    $or: [
                      { $eq: ['$$label.validation.validated', true] },
                      { $eq: ['$$label.validation.validated', false] },
                    ],
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    $match: {
      // image has an object that is locked,
      // but it doesn't have any validated (or invalidated) labels
      objects: {
        $elemMatch: {
          locked: true,
          allValidatedLabels: { $exists: true, $eq: [] },
        },
      },
    },
  },
];

const operations = {
  'add-tag-filter-to-views': {
    getIds: async () => await Project.find({}).select('_id'),
    update: async () => {
      console.log('Adding tag filter to all Project.views...');
      const projects = await Project.find({});
      try {
        const res = { nModified: 0 };
        for (const proj of projects) {
          for (const view of proj.views) {
            console.log(`Updating view ${view.name} in project ${proj.name}: ${view.filters}`);
            // if (view.filters.editable) {
            //   view.filters = {
            //     ...view.filters,
            //     tags: null,
            //   };
            // }
          }
          await proj.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },
  'unlock-objects-with-all-non-validated-labels': {
    // Unlock all objects that don't have any validated or invalidated labels
    // (Label.validation === null or undefined), and mark image as not reviewed
    // https://github.com/tnc-ca-geo/animl-api/issues/256
    getIds: async () => {
      const aggregation = await Image.aggregate(pipeline);
      // console.log(aggregation);
      return aggregation.map((img) => img._id);
    },
    update: async () => {
      console.log('Unlocking objects with all non-validated labels...');
      const imagesToUpdate = await Image.aggregate(pipeline);
      try {
        const res = { nModified: 0 };
        for await (const img of imagesToUpdate) {
          const image = await Image.findOne({ _id: img._id });
          for (const [i, obj] of img.objects.entries()) {
            // unlock object if it has no validated labels
            if (obj.locked && obj.allValidatedLabels.length === 0) {
              image.objects[i].locked = false;
            }
          }
          // update reviewed state
          image.reviewed = isImageReviewed(image);
          await image.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },

  'add-project-labels-ml-field': {
    getIds: async () => await Project.find({}).select('_id'),
    update: async () => {
      console.log('Adding ml field to all ProjectLabels...');
      const projects = await Project.find({});
      try {
        const res = { nModified: 0 };
        const isMl = async (proj, lbl) => {
          if (lbl.name === 'empty') return true;
          const imgs = await Image.find({
            projectId: proj._id,
            'objects.labels': { $elemMatch: { type: 'ml', labelId: lbl._id } },
          }).select('_id');
          return imgs.length > 0;
        };
        for (const proj of projects) {
          for (const lbl of proj.labels) {
            lbl.ml = await isMl(proj, lbl);
          }
          await proj.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },

  'add-image-dimensions': {
    getIds: async () =>
      await Image.find({
        // projectId: 'wolf_data',
        imageWidth: { $exists: false },
      }).select('_id'),
    update: async (config) => {
      console.log('Adding image dimensions to all images...');

      const _getImageSize = async (image, config) => {
        const url = buildImgUrl(image, config);
        try {
          const res = await fetch(url);
          const body = await res.arrayBuffer();
          const imgBuffer = Buffer.from(body, 'binary');
          const sharpMetadata = await sharp(imgBuffer).metadata();
          // console.log('sharpMetadata', sharpMetadata);
          return { width: sharpMetadata.width, height: sharpMetadata.height };
        } catch (err) {
          throw new Error(err);
        }
      };

      const imgs = await Image.find({
        // projectId: 'wolf_data',
        imageWidth: { $exists: false },
      });
      try {
        const res = { nModified: 0 };
        for (const img of imgs) {
          const { width, height } = await _getImageSize(img, config);
          img.imageHeight = height;
          img.imageWidth = width;
          await img.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },

  'change-label-id': {
    getIds: async () =>
      await Image.find({
        projectId: 'lord_howe_island',
        'objects.labels.labelId': '0',
      }).select('_id'),
    update: async () => {
      console.log(
        'changing labelId for "empty" labels from "0" to "empty" on lord_howe_island images',
      );
      const imgs = await Image.find({
        projectId: 'lord_howe_island',
        'objects.labels.labelId': '0',
      });
      try {
        const res = { nModified: 0 };
        for (const img of imgs) {
          for (const obj of img.objects) {
            for (const lbl of obj.labels) {
              if (lbl.labelId === '0') {
                lbl.labelId = 'empty';
              }
            }
          }
          await img.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },

  'add-timezone-field': {
    getIds: async () => await Image.find({}).select('_id'),
    update: async () => {
      console.log('adding timezone field to all images');
      const tz = 'America/Los_Angeles';
      return await Image.updateMany({}, { $set: { timezone: tz } });
    },
  },

  'shift-dto': {
    getIds: async () => await Image.find({}).select('_id'),
    update: async () => {
      console.log('shifting all dateTimeOriginal fields from UTC+0 to America/Los_Angeles time');
      const operations = [];
      const imgs = await Image.find({}, ['_id', 'dateTimeOriginal']);
      try {
        for (const img of imgs) {
          // NOTE: 'Africa/Abidjan' is UTC+0.
          // I tried using { setZone: true } instead thinking that because the
          // ISO string stored in mongoDB had +0:00 it would be correctly set to
          // a UTC+0 offset, but this was not the case. It read the date in
          // my local Los Angeles time, so setting the zone didn't do anything
          const dtOriginal = DateTime.fromJSDate(img.dateTimeOriginal, { zone: 'Africa/Abidjan' });
          const newDT = dtOriginal.setZone('America/Los_Angeles', { keepLocalTime: true });
          const op = {
            updateOne: {
              filter: { _id: img._id },
              update: {
                dateTimeOriginal: newDT,
                dateTimeAdjusted: newDT,
              },
            },
          };
          operations.push(op);
        }
      } catch (err) {
        console.error(err);
        throw err;
      }

      try {
        return await Image.bulkWrite(operations);
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },

  'remove-objects-w-no-labels': {
    getIds: async () => await Image.find({ 'objects.labels': { $size: 0 } }).select('_id'),
    update: async () => {
      console.log('Removing objects with empty labels arrays...');
      return await Image.updateMany({}, { $pull: { objects: { labels: { $size: 0 } } } });
    },
  },

  'pair-all-images-with-project': {
    getIds: async () => await Image.find({}).select('_id'),
    update: async () => {
      console.log('Associating all images with sci_biosecurity project...');
      return await Image.updateMany({}, { projectId: 'sci_biosecurity' });
    },
  },

  'update-labels-to-new-schema': {
    getIds: async () =>
      await Image.find({
        // 'projectId': 'sci_biosecurity',
        'objects.labels.type': 'ml',
      }).select('_id'),
    update: async () => {
      console.log('Updatind labels w/ new mlModel and mlModelVersion fields...');
      // TODO: these must be modified to match the model Ids in your target db
      const megadetectorId = '6163b013796cd67379391a59';
      const miraId = '6163b013796cd67379391a5a';

      const mergeExpression = {
        $mergeObjects: [
          '$$lbl',
          {
            mlModel: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$$lbl.modelId', ObjectId(megadetectorId)] },
                    then: 'megadetector',
                  },
                  {
                    case: { $eq: ['$$lbl.modelId', ObjectId(miraId)] },
                    then: 'mira',
                  },
                ],
                default: '$$REMOVE',
              },
            },
          },
          {
            mlModelVersion: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$$lbl.modelId', ObjectId(megadetectorId)] },
                    then: 'v4.1',
                  },
                  {
                    case: { $eq: ['$$lbl.modelId', ObjectId(miraId)] },
                    then: 'v1.0',
                  },
                ],
                default: '$$REMOVE',
              },
            },
          },
        ],
      };

      // updateMany with aggregation pipeline
      return await Image.updateMany(
        {
          // 'project': 'sci_biosecurity',
          'objects.labels.type': 'ml',
        },
        [
          {
            $set: {
              objects: {
                $map: {
                  input: '$objects',
                  as: 'obj',
                  in: {
                    // TODO AUTH - DOUBLE CHECK THIS IS WORKING.
                    // PREVIOUSLY I WIPED OUT object._id, object.locked, and object.bbox!!
                    _id: '$$obj._id',
                    locked: '$$obj.locked',
                    bbox: '$$obj.bbox',
                    labels: {
                      $map: {
                        input: '$$obj.labels',
                        as: 'lbl',
                        in: mergeExpression,
                      },
                    },
                  },
                },
              },
            },
          },
          { $unset: ['objects.labels.modelId'] },
        ],
      );
    },
  },

  'update-image-schema': {
    getIds: async () => await Image.find({}).select('_id'),
    update: async () => {
      console.log('Updating all images with new property keys...');
      return await Image.updateMany(
        {},
        {
          $rename: {
            cameraSn: 'cameraId',
            deployment: 'deploymentId',
          },
        },
        { strict: false },
      );
    },
  },

  'add-reviewed-field-to-images': {
    getIds: async () => await Image.find().select('_id'),
    update: async () => {
      console.log('Adding reviewed field to all images...');

      let skip = 0;
      const limit = 5000; // how many images to fetch at a time
      const count = await Image.countDocuments();
      console.log('Number of documents: ', count);
      let doneCount = 0;

      while (skip < count) {
        const documents = await Image.find().skip(skip).limit(limit);
        const operations = [];
        for (const image of documents) {
          operations.push({
            updateOne: {
              filter: { _id: image._id },
              update: { $set: { reviewed: isImageReviewed(image) } },
            },
          });
        }
        await Image.bulkWrite(operations);
        skip += limit;
        doneCount += documents.length;
        console.log('Done: ', doneCount);
      }
      return { nModified: doneCount };
    },
  },

  'backfill-datetime-adjusted': {
    getIds: async () => await Image.find({ dateTimeAdjusted: { $exists: false } }).select('_id'),
    update: async () => {
      console.log('Backfilling dateTimeAdjusted field from dateTimeOriginal...');

      const limit = 5000;
      let doneCount = 0;
      let hasMore = true;

      while (hasMore) {
        const documents = await Image.find({ dateTimeAdjusted: { $exists: false } }).limit(limit);

        if (documents.length === 0) {
          console.log('No more documents to process');
          hasMore = false;
          break;
        }

        const operations = [];
        for (const image of documents) {
          operations.push({
            updateOne: {
              filter: { _id: image._id },
              update: { $set: { dateTimeAdjusted: image.dateTimeOriginal } },
            },
          });
        }
        await Image.bulkWrite(operations);
        doneCount += operations.length;
        console.log('Done: ', doneCount);
      }
      return { nModified: doneCount };
    },
  },

  'add-queryable-label-ids-to-images': {
    getIds: async () => await Image.find().select('_id'),
    update: async () => {
      console.log('Adding queryableLabelIds to all images...');

      let skip = 0;
      const limit = 5000; // how many images to fetch at a time
      const count = await Image.countDocuments();
      console.log('Number of documents: ', count);
      let doneCount = 0;

      while (skip < count) {
        const documents = await Image.find().skip(skip).limit(limit);
        const operations = [];
        for (const image of documents) {
          operations.push({
            updateOne: {
              filter: { _id: image._id },
              update: {
                $set: { queryableLabelIds: getQueryableLabelIds(image) },
              },
            },
          });
        }
        await Image.bulkWrite(operations);
        skip += limit;
        doneCount += documents.length;
        console.log('Done: ', doneCount);
      }
      return { nModified: doneCount };
    },
  },

  'backfill-project-created': {
    getIds: async () => await Project.find({ created: { $exists: false } }).select('_id'),
    update: async () => {
      console.log('Backfilling created field on all projects...');
      const projects = await Project.find({ created: { $exists: false } });
      try {
        const res = { nModified: 0 };
        for (const proj of projects) {
          let created;
          const defaultView = proj.views.find((v) => v.name === 'All images');
          if (defaultView && defaultView._id) {
            created = defaultView._id.getTimestamp();
            console.log(
              `Project ${proj._id}: derived created date ${created} from "All images" view ObjectId`,
            );
          } else {
            created = new Date();
            console.warn(
              `Project ${proj._id}: no "All images" view found, falling back to current date`,
            );
          }
          proj.created = created;
          await proj.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },

  'audit-unlocked-objects-with-reviewed-labels': {
    // Generate a CSV report and JSON backup of images affected by the
    // out-of-order mutation race condition (issue #316)
    getIds: async () => {
      const { ids } = await getAffectedImageIds();
      return ids;
    },
    update: async () => {
      console.log('Auditing images with incorrectly unlocked objects...');
      const { entries, ids } = await getAffectedImageIds();

      if (ids.length === 0) {
        console.log('No affected images found.');
        return { nModified: 0 };
      }

      // Fetch full image records for JSON backup
      const images = await Image.find({ _id: { $in: ids } });

      // Write outputs
      const stage = process.env.STAGE || 'dev';
      const dt = DateTime.now().setZone('utc').toFormat("yyyy-LL-dd'T'HHmm'Z'");
      const backupsRoot = path.join(appRoot.path, backupConfig.BACKUP_DIR);
      const outDir = path.join(backupsRoot, 'issue-316-backfill');

      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      // CSV report
      const csvHeader = '_id,projectId,case';
      const csvRows = entries.map((e) => `${e._id},${e.projectId},${e.case}`);
      const csvContent = [csvHeader, ...csvRows].join('\n');
      const csvPath = path.join(outDir, `${stage}_affected-images_${dt}.csv`);
      fs.writeFileSync(csvPath, csvContent, 'utf8');
      console.log(`CSV report written to: ${csvPath}`);
      console.log(
        `  Case A (all labels invalidated, unlocked): ${entries.filter((e) => e.case.includes('A')).length}`,
      );
      console.log(
        `  Case B (has validated label, unlocked): ${entries.filter((e) => e.case.includes('B')).length}`,
      );

      // JSON backup of full records
      const jsonPath = path.join(outDir, `${stage}_affected-images-backup_${dt}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(images, null, 2), 'utf8');
      console.log(`JSON backup written to: ${jsonPath}`);

      return { nModified: ids.length };
    },
  },

  'fix-unlocked-objects-with-reviewed-labels': {
    // Lock objects that should be locked and update image review status
    // for images affected by the out-of-order mutation race condition (issue #316)
    getIds: async () => {
      const { ids } = await getAffectedImageIds();
      return ids;
    },
    update: async () => {
      console.log('Fixing images with incorrectly unlocked objects...');
      const { ids } = await getAffectedImageIds();

      if (ids.length === 0) {
        console.log('No affected images found.');
        return { nModified: 0 };
      }

      try {
        const res = { nModified: 0 };
        for (const id of ids) {
          const image = await Image.findOne({ _id: id });
          if (!image) continue;

          for (const obj of image.objects) {
            if (obj.locked) continue;

            const hasValidatedLabel = obj.labels.some(
              (lbl) => lbl.validation && lbl.validation.validated === true,
            );
            const allLabelsInvalidated =
              obj.labels.length > 0 &&
              obj.labels.every((lbl) => lbl.validation && lbl.validation.validated === false);

            if (hasValidatedLabel || allLabelsInvalidated) {
              obj.locked = true;
            }
          }

          image.reviewed = isImageReviewed(image);
          image.queryableLabelIds = getQueryableLabelIds(image);
          await image.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.error(err);
        throw err;
      }
    },
  },
};

export { operations };
