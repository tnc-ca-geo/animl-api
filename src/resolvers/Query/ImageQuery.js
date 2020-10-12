const mongoose = require('mongoose');
const Image = require('../../db/models/Image');

// TODO: make sure I have resolvers to match all possible nested queries 
// in resolver chain (i.e., if request asks for images { camera { make }}
// make sure camera is handled in resolver chain (maybe with populate()?)

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

const images = async (parent, args, context) => {
  try {
    const db = await context.connectToDatabase();
    const filter = buildFilter(args);
    console.log('Finding image with filter: ', filter);
    const query = Image.find(filter);
    const images = await query.exec();
    console.log('Found images: ', images);
    // TODO: experiement with popuplate() on cameraSn field
    return images;
  } catch (err) {
    throw new Error(err);
  }
};

const image = async (parent, { _id }, context) => {
  console.log('Finding image with _id: ', _id)
  try {
    const db = await context.connectToDatabase();
    const image = await Image.findOne({_id})
    console.log('found image: ', image)
    return image;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  images,
  image,
};
