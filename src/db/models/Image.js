const moment = require('moment');
const Image = require('../schemas/Image');
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

const buildFilter = (input) => {
  let filter = {};
  if (input.cameras) {
    filter = {
      ...filter,
      'cameraSn': { $in: input.cameras },
    }
  }
  if (input.createdStart || input.createdEnd) {
    filter = {
      ...filter,
      'dateTimeOriginal': {
        ...(input.createdStart && { $gte: input.createdStart.toDate() }),
        ...(input.createdEnd && { $lt: input.createdEnd.toDate() }),
      },
    }
  }
  return filter;
};

const generateImageModel = () => ({

  countImages: async (input) => {
    const query = buildFilter(input);
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

  createImage: async (input) => {
    try {
      const md = sanitizeMetadata(input.md);
      const newImage = utils.mapMetaToModel(md);
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
