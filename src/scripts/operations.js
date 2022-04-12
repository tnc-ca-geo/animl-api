const Image = require('../api/db/schemas/Image');
const ObjectId = require('mongoose').Types.ObjectId;

const operations = {

  'remove-objects-w-no-labels': {
    getIds: async () => (
      await Image.find({ 'objects.labels': { $size: 0 } }).select('_id')
    ),
    update: async () => {
      console.log('Removing objects with empty labels arrays...');
      return await Image.updateMany(
        {},
        { $pull: { objects: { labels: { $size: 0} } } }
      )
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
        'project': 'sci_biosecurity',   // TODO: don't forget to change this
        'objects.labels.type': 'ml',
      }).select('_id')
    ),
    update: async () => {
      console.log('Updatind labels w/ new mlModel and mlModelVersion fields...');
      const megadetectorId = "61eb283678ed7390a51835ce"; // TODO: don't forget to change this to correct ID in prod
      const miraId = "61eb283678ed7390a51835d0"; // TODO: don't forget to change this to correct ID in prod

      const mergeExpression = {
        $mergeObjects: [ 
          "$$lbl",  
          { mlModel: { 
              $switch: {
                branches: [
                  { 
                    case: { $eq: ["$$lbl.modelId", ObjectId(megadetectorId)] }, 
                    then: "megadetector" 
                  },
                  { 
                    case: { $eq: ["$$lbl.modelId", ObjectId(miraId)] },
                    then: "mira" 
                  },
                ],
                default: "$$REMOVE",
              }
            } 
          },
          { mlModelVersion: { 
              $switch: {
                branches: [
                  { 
                    case: { $eq: ["$$lbl.modelId", ObjectId(megadetectorId)] }, 
                    then: "v4.1" 
                  },
                  { 
                    case: { $eq: ["$$lbl.modelId", ObjectId(miraId)] },
                    then: "v1.0" 
                  },
                ],
                default: "$$REMOVE",
              }
            } 
          }
        ],
      };

      // updateMany with aggregation pipeline
      return await Image.updateMany(
        {
          'project': 'sci_biosecurity',  // TODO: don't forget to change this
        },
        [
          {
            $set: {
              "objects": {
                $map: {
                  input: "$objects",
                  as: "obj",
                  in: {
                    // TODO AUTH - DOUBLE CHECK THIS IS WORKING. 
                    // PREVIOUSLY I WIPED OUT object._id, object.locked, and object.bbox!!
                    "_id": "$$obj._id",
                    "locked": "$$obj.locked",
                    "bbox": "$$obj.bbox",
                    "labels": {
                      $map: {
                        input: "$$obj.labels",
                        as: "lbl",
                        in: mergeExpression,
                      }
                    }
                  }
                }
              }
            }
          },
          { $unset: ["objects.labels.modelId"] }
        ]
      );
    },
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
          'project': 'projectId',
          'deployment': 'deploymentId',
        } 
      }, { strict: false });
    }
  },

}
module.exports = {
  operations,
}