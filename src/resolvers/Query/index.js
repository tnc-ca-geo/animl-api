const cameraQuery = require('./CameraQuery');
const ImageQuery = require('./ImageQuery');
const CameraQuery = require('./CameraQuery');

module.exports = {
  ...ImageQuery,
  ...CameraQuery,
};

