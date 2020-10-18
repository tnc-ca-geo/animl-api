const mongoose = require('mongoose');
const Camera = require('../../db/models/Camera');

// Field level resolver for Image.camera()
const camera = async (parent, args, context) => {
  try {
    const db = await context.connectToDatabase();
    const camera = await Camera.findById(parent.cameraSn).exec();
    return camera;
  } catch (err) {
    throw new Error(err);
  }
};


module.exports = {
  camera
};
