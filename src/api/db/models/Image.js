const Image = require('../schemas/Image');
const utils = require('./utils');
const { SQS } = require('aws-sdk');

const sqs = new SQS();

const queueForAutomation = async (message, context) => {
  console.log('queueForAutomation() firing')
  const views = await context.models.View.getViews();
  message.views = views;
  const region = 'us-west-1';
  const accountId = '830244800171';
  const queueName = 'automationQueue';
  const queueUrl= `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`
  console.log('sending message to queue: ', message);
  await sqs.sendMessage({
    QueueUrl: queueUrl,
    MessageBody: JSON.stringify(message),
    MessageAttributes: {
      AttributeNameHere: {
        StringValue: 'Attribute Value Here',
        DataType: 'String',
      },
    },
  }).promise();
  console.log('success?')
}

const generateImageModel = () => ({

  countImages: async (input) => {
    const query = utils.buildFilter(input);
    const count = await Image.where(query).countDocuments();
    return count;
  },

  queryById: async (_id) => {
    try {
      const image = await Image.findOne({_id});
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

  get createLabel() {
    return async (input, context) => {
      const { imageId, label } = input;
      console.log(`creating label: ${label.category}`);
      try {
        // get image
        const image = await this.queryById(imageId);
        const newLabel = utils.createLabelRecord(label, label.modelId);
        image.labels.push(newLabel);
        await image.save();

        // TODO: it would great for this to be async. is that advisible in lambda?
        // await context.automation.initiate({
        //   event: 'label-added',
        //   image: image,
        //   label: newLabel,
        // }, context);

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
      await newImage.save();
      // TODO: move automation to it's own lambda, invoke it here 
      // (or set up sqs queue and send message to sqs)
      // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Lambda.html#invoke-property
      // await context.automation.initiate({
      //   event: 'image-added',
      //   image: newImage
      // }, context);
      console.log('context from models.Image.createImage: ', context);
      await queueForAutomation({
        event: 'image-added',
        image: newImage,
      }, context);

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
