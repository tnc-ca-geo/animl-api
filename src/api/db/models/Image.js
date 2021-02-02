const Image = require('../schemas/Image');
const automation = require('../../../automation');
const utils = require('./utils');

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
        for (const label of labels) {
          const labelRecord = utils.createLabelRecord(label, label.modelId);
          console.log(`createLabels() - Adding label ${labelRecord.category} to image: ${image.originalFileName}`);
          image.labels.push(labelRecord);
          await image.save();
          await automation.handleEvent({
            event: 'label-added',
            image: image,
            label: labelRecord,
          }, context);
        }
        console.log(`createLabels success. Returning`);
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
      console.log(`createImage() - Adding image ${newImage.originalFileName} to db`);
      await newImage.save();
      await automation.handleEvent({
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
