import Image from '../api/db/schemas/Image.js';
import Mongoose from 'mongoose';
import { DateTime } from 'luxon';

const ObjectId = Mongoose.Types.ObjectId;

const operations = {

  'change-label-id': {
    getIds: async () => (
      await Image.find({
        projectId: 'lord_howe_island',
        'objects.labels.labelId': '0'
      }).select('_id')
    ),
    update: async () => {
      console.log('changing labelId for "empty" labels from "0" to "empty" on lord_howe_island images');
      const imgs = await Image.find({
        projectId: 'lord_howe_island',
        'objects.labels.labelId': '0'
      });
      try {
        const res = { nModified: 0 };
        for (const img of imgs) {
          for (const obj of img.objects) {
            for (const lbl of obj.labels) {
              if (lbl.labelId === '0'){
                lbl.labelId = 'empty';
              }
            }
          }
          await img.save();
          res.nModified++;
        }
        return res;
      } catch (err) {
        console.log(err);
      }

    }
  },

  'add-timezone-field': {
    getIds: async () => (
      await Image.find({}).select('_id')
    ),
    update: async () => {
      console.log('adding timezone field to all images');
      const tz = 'America/Los_Angeles';
      return await Image.updateMany({}, { $set: { 'timezone': tz } });
    }
  },

  'shift-dto': {
    getIds: async () => (
      await Image.find({}).select('_id')
    ),
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
              update : { dateTimeOriginal: newDT } }
          };
          operations.push(op);
        }
      } catch (err) {
        console.log(err);
      }

      try {
        return await Image.bulkWrite(operations);
      } catch (err) {
        console.log(err);
      }
    }
  },

  'remove-objects-w-no-labels': {
    getIds: async () => (
      await Image.find({ 'objects.labels': { $size: 0 } }).select('_id')
    ),
    update: async () => {
      console.log('Removing objects with empty labels arrays...');
      return await Image.updateMany(
        {},
        { $pull: { objects: { labels: { $size: 0 } } } }
      );
    }
  },

  'pair-all-images-with-project': {
    getIds: async () => (
      await Image.find({}).select('_id')
    ),
    update: async () => {
      console.log('Associating all images with sci_biosecurity project...');
      return await Image.updateMany({}, { projectId: 'sci_biosecurity' });
    }
  },

  'update-labels-to-new-schema': {
    getIds: async () => (
      await Image.find({
        // 'projectId': 'sci_biosecurity',
        'objects.labels.type': 'ml'
      }).select('_id')
    ),
    update: async () => {
      console.log('Updatind labels w/ new mlModel and mlModelVersion fields...');
      // TODO: these must be modified to match the model Ids in your target db
      const megadetectorId = '6163b013796cd67379391a59';
      const miraId = '6163b013796cd67379391a5a';

      const mergeExpression = {
        $mergeObjects: [
          '$$lbl',
          { mlModel: {
            $switch: {
              branches: [{
                case: { $eq: ['$$lbl.modelId', ObjectId(megadetectorId)] },
                then: 'megadetector'
              },{
                case: { $eq: ['$$lbl.modelId', ObjectId(miraId)] },
                then: 'mira'
              }],
              default: '$$REMOVE'
            }
          }
          },
          { mlModelVersion: {
            $switch: {
              branches: [{
                case: { $eq: ['$$lbl.modelId', ObjectId(megadetectorId)] },
                then: 'v4.1'
              },{
                case: { $eq: ['$$lbl.modelId', ObjectId(miraId)] },
                then: 'v1.0'
              }],
              default: '$$REMOVE'
            }
          }
          }
        ]
      };

      // updateMany with aggregation pipeline
      return await Image.updateMany(
        {
          // 'project': 'sci_biosecurity',
          'objects.labels.type': 'ml'
        },
        [
          {
            $set: {
              'objects': {
                $map: {
                  input: '$objects',
                  as: 'obj',
                  in: {
                    // TODO AUTH - DOUBLE CHECK THIS IS WORKING.
                    // PREVIOUSLY I WIPED OUT object._id, object.locked, and object.bbox!!
                    '_id': '$$obj._id',
                    'locked': '$$obj.locked',
                    'bbox': '$$obj.bbox',
                    'labels': {
                      $map: {
                        input: '$$obj.labels',
                        as: 'lbl',
                        in: mergeExpression
                      }
                    }
                  }
                }
              }
            }
          },
          { $unset: ['objects.labels.modelId'] }
        ]
      );
    }
  },

  'update-image-schema': {
    getIds: async () => (
      await Image.find({}).select('_id')
    ),
    update: async () => {
      console.log('Updating all images with new property keys...');
      return await Image.updateMany({}, {
        $rename: {
          'cameraSn': 'cameraId',
          'deployment': 'deploymentId'
        }
      }, { strict: false });
    }
  },

  'add-reviewed-field-to-images': {
    getIds: async () => (
      await Image.find().select('_id')
    ),
    update: async () => {
      console.log('Adding reviewed field to all images...');

      let skip = 0;
      let limit = 1; // how many images to fetch at a time
      let count = Image.countDocuments();
      console.log('Total documents: ', count);
      let doneCount = 0

      while (skip < count) {
        const documents = await Image.find().skip(skip).limit(limit).toArray();
        console.log('documents fetched: ', documents.length);
        const operations = []
        for (image in documents) {
          operations.push({
            updateOne: {
              filter: { _id: image._id },
              update: { $set: { reviewed: isImageReviewed(image) } }
            }
          });
        }
        await Image.bulkWrite(operations);
        skip += limit;
        doneCount += documents.length;
      }
      return { nModified: doneCount };
    }
  },
};

export {
  operations
};
