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

const buildFilter = (args) => {
  let filter = {};
  if (args.cameras) {
    filter = {
      ...filter,
      'cameraSn': args.cameras,
    }
  }
  if (args.createdStart && args.createdEnd) {
    filter = {
      ...filter,
      dateTimeOriginal: {
        $gte: args.createdStart,
        $lt: args.createdEnd
      },
    }
  }
  return filter;
};

const generateImageModel = ({ connectToDb }) => ({
  queryById: async (_id) => {
    try {
      console.log('Finding image with _id: ', _id)
      const db = await connectToDb();
      const image = await Image.findOne({_id});
      console.log('found image: ', image);
      return image;
    } catch (err) {
      throw new Error(err);
    }
  },
  queryByFilter: async (filterArgs) => {
    try {
      const db = await connectToDb();
      const filter = buildFilter(filterArgs);
      console.log('Finding image with filter: ', filter);

      // const query = Image.find(filter);
      // const images = await query.exec();

      // TODO: break up filter args and pagination args into separate
      // input params
      const options = (filterArgs.offset >= 0 && filterArgs.limit)
        ? { offset: filterArgs.offset, limit: filterArgs.limit }
        : { pagination: false };

      console.log('and pagination options: ', options);
      const result = await Image.paginate(filter, options);
      // console.log('Result: ', result);
      return result;
    } catch (err) {
      throw new Error(err);
    }
  },
  createImage: async (input) => {
    try {
      console.log('Saving image image with input: ', input);
      const db = await connectToDb();
      const md = sanitizeMetadata(input.md);
      const newImage = utils.mapMetaToModel(md);
      await newImage.save();
      console.log('Successfully saved image: ', newImage);
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
