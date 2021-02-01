const Image = require('../schemas/Image');
const utils = require('./utils');
const { SQS } = require('aws-sdk');
const config = require('../../../config/config');

const sqs = new SQS();

const addToAutomationQueue = async (message, context) => {
  console.log(`Adding ${message.image.originalFileName} to automation queue`);
  if (message.label) {
    console.log(`newly added label: ${message.label.category}`)
  }
  const views = await context.models.View.getViews();
  message.views = views;
  console.log(`Adding views to sqs message`)
  const res = await sqs.sendMessage({
    QueueUrl: config.AUTOMATION_QUEUE_URL,
    MessageBody: JSON.stringify(message),
    MessageGroupId: config.SQS_MESSAGE_GROUP_ID,
  }).promise();
  console.log('message sent: ', res);
};

const generateImageModel = () => ({

  countImages: async (input) => {
    const query = utils.buildFilter(input);
    const count = await Image.where(query).countDocuments();
    return count;
  },

  queryById: async (_id) => {
    try {
      const image = await Image.findOne({_id});
      console.log('image: ', image);
      return image;
    } catch (err) {
      throw new Error(err);
    }
  },

  queryByFilter: async (input) => {
    try {
      const options = {
        query: utils.buildFilter(input),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      };
      const result = await Image.paginate(options);
      return result;
    } catch (err) {
      throw new Error(err);
    }
  },

  get createLabels() {
    return async (input, context) => {
      const { imageId, labels } = input;
      try {
        const image = await this.queryById(imageId);
        for (label of labels) {
          const labelRecord = utils.createLabelRecord(label, label.modelId);
          console.log(`Adding label ${labelRecord.category} to image: ${image.originalFileName}`);
          image.labels.push(labelRecord);
          await image.save();
          await addToAutomationQueue({
            event: 'label-added',
            image: image,
            label: labelRecord,
          }, context);
        }
        return image;
      } catch (err) {
        throw new Error(err);
      }
    }
  },

  getLabels: async () => {
    try {
      const categories = await Image.distinct('labels.category');
      const labellessImage = await Image.findOne({labels: { $size: 0 }});
      if (labellessImage) {
        categories.push('none');
      }
      return { categories };
    } catch (err) {
      throw new Error(err);
    }
  },

  createImage: async (input, context) => {
    try {
      const md = utils.sanitizeMetadata(input.md);
      const newImage = utils.createImageRecord(md);
      console.log(`Adding image ${newImage.originalFileName} to db`);
      await newImage.save();
      await addToAutomationQueue({
        event: 'image-added',
        image: newImage,
      }, context);
      console.log(`createImage success. Returning`);
      return newImage;
    } catch (err) {
      throw new Error(err);
    }
  },

 });

module.exports = generateImageModel;


// TODO: pass user into model generators to perform authorization at the 
// data fetching level. e.g.:
// export const generateImageModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
