const mongoose = require('mongoose');
const Camera = require('../../db/models/Camera');

// TODO: make sure I have resolvers to match all possible nested queries 
// in resolver chain (i.e., if request asks for cameras { images { hash }}
// make sure images is handled in resolver chain

const cameras = async (parent, { _ids }, context) => {
  console.log('Finding cameras: ', _ids);
  try {
    const db = await context.connectToDatabase();
    let cameras;
    if (_ids) {
      cameras = await Camera.find({ _id: { $in: _ids } });
    }
    else {
      cameras = await Camera.find({}); // return all cameras
    }
    console.log('Found cameras: ', cameras);
    return cameras;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  cameras,
};
