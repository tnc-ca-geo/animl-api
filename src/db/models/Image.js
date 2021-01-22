const moment = require('moment');
const Image = require('../schemas/Image');
const inference = require('../../automation/inference');
const utils = require('./utils');
const config = require('../../config/config');

const sanitizeMetadata = (md) => {
  let sanitized = {};
  // If second char in key is uppercase,
  // assume it's an acronym (like GPSLatitude) & leave it,
  // else camel case
  for (let key in md) {
    const newKey = !(key.charAt(1) == key.charAt(1).toUpperCase())
      ? key.charAt(0).toLowerCase() + key.slice(1)
      : key;
    sanitized[newKey] = md[key];
  }
  const dto = moment(sanitized.dateTimeOriginal, config.TIME_FORMATS.EXIF);
  sanitized.dateTimeOriginal = dto;
  return sanitized;
};

const buildFilter = ({
  cameras,
  createdStart,
  createdEnd,
  addedStart,
  addedEnd,
  labels,
}) => {

  let camerasFilter = {};
  if (cameras) {
    camerasFilter = {'cameraSn': { $in: cameras }}
  }

  let dateCreatedFilter =  {};
  if (createdStart || createdEnd) {
    dateCreatedFilter = {'dateTimeOriginal': {
      ...(createdStart && { $gte: createdStart.toDate() }),
      ...(createdEnd && { $lt: createdEnd.toDate() }),
    }};
  }

  let dateAddedFilter = {};
  if (addedStart || addedEnd) {
    dateAddedFilter = {'dateAdded': {
      ...(addedStart && { $gte: addedStart.toDate() }),
      ...(addedEnd && { $lt: addedEnd.toDate() }),
    }};
  }

  let labelsFilter = {};
  if (labels) {
    labelsFilter = labels.includes('none')
      ? { $or: [{'labels.category': { $in: labels }}, { labels: { $size: 0 }}]}
      : { 'labels.category': { $in: labels } };
  };

  return {
    ...camerasFilter,
    ...dateCreatedFilter,
    ...dateAddedFilter,
    ...labelsFilter,
  };
};

const generateImageModel = () => ({

  countImages: async (input) => {
    const query = buildFilter(input);
    // console.log('input.addedStart: ', input.addedStart)
    // console.log('input.addedStart.toDate(): ', input.addedStart.toDate())
    console.log('query: ', query)
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
        query: buildFilter(input),
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

  createImage: async (input) => {
    try {
      const md = sanitizeMetadata(input.md);
      const newImage = utils.createImageRecord(md);
      await newImage.save();

      // Just putting this here temporarily for testing. should all be abstracted:
      // TODO: get Model record from db
      const model = { name: 'megadetector' };
      const detections = await inference.callMegadetector(newImage);
      const newLabels = detections.map((det) => utils.createLabelRecord(det, model));
      newImage.labels = newImage.labels.concat(newLabels);
      console.log('newImage before saving: ', newImage)
      await newImage.save();

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
