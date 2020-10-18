const moment = require('moment');
const config = require('../../config/config');
const utils = require('./utils');
const CameraModel = require('../../db/models/Camera');

const detectObjects = async (image) => {
  // TODO: hardcoded return value is just for testing 
  // integrate with megadetector endpoint here
  console.log('Detecting objects...');
  setTimeout(() => {
    const objects = [
      {
        type: 'ml',
        category: 'skunk',
        conf: 87.1,
        bbox: [1, 2],
        labeledDate: moment(),
        validation: {
          reviewed: false,
          validated: false,
        }
      }
    ];
    objects.forEach((object) => {
      image.labels.push(object);
    });
    image.save();
  }, 1000);
};

const createCamera = async (image) => {
  const existingCam = await CameraModel.find({ _id: image.cameraSn });
  if (existingCam.length === 0) {
    console.log('Creating new camera document');
    const newCamera = new CameraModel({
      _id: image.cameraSn,
      make: image.make,
      ...(image.model && { model: image.model }),
    });
    await newCamera.save();
    console.log('successfully saved camera: ', newCamera);
  }
  else {
    console.log('Camera record already exists: ', existingCam);
  }
}

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
    await createCamera(newImage);
    await detectObjects(newImage);

    // return value must match CreateImagePayload schema
    return { image: newImage };
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  createImage
};
