const mongoose = require('mongoose');
const Image = require('../../db/models/Image');

// Field level resolver for Camera.images()
const images = async (parent, args, context) => {
  try {
    const db = await context.connectToDatabase(); // do we need to do this?
    const images = await Image.find({ cameraSn: parent._id }).exec();
    return images;
  } catch (err) {
    throw new Error(err);
  }
};


module.exports = {
  images
};
