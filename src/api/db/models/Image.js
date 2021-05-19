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

          if (utils.isLabelDupe(image, label)) {
            return;
          }
          // TODO: if label was created on front-end, use ID front-end generated?
          const labelRecord = utils.createLabelRecord(label, label.modelId);
          console.log(`createLabels() - Adding label "${labelRecord.category}" to image: ${image.originalFileName}`);
          let objExists = false;
          for (const object of image.objects) {
            if (_.isEqual(object.bbox, label.bbox)) {
              object.labels.unshift(labelRecord);
              objExists = true;
              break;
            }
          }
          if (!objExists) {
            // TODO: if object was created on front-end, use ID front-end generated?
            image.objects.unshift({
              bbox: labelRecord.bbox,
              locked: false,
              labels: [labelRecord],
            });
          }

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
      const categories = await Image.distinct('objects.labels.category');
      const labellessImage = await Image.findOne({ objects: { $size: 0 } });
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
      const md = utils.sanitizeMetadata(input.md, context.config);
      const newImage = utils.createImageRecord(md);
      console.log(`createImage() - Adding image "${newImage.originalFileName}" to db`);
      await newImage.save();
      await automation.handleEvent({
        event: 'image-added',
        image: newImage,
      }, context);
      console.log(`createImage success. Returning`);
      return newImage;
    } catch (err) {
      console.log('error caught in createImage try/catch: ', err);
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
