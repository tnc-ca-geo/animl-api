const moment = require('moment');
const config = require('../../config/config');
const utils = require('./utils');

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

const createImage = async (_, { input }, context) => {
  console.log('Saving image with input: ', input);
  try {
    const db = await context.connectToDatabase();
    const md = sanitizeMetadata(input.md);
    const newImage = utils.mapMetaToModel(md);
    await newImage.save();
    console.log('Successfully saved image: ', newImage);

    // return value must match CreateImagePayload schema
    return { image: newImage };
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  createImage
};
