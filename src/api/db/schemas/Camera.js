const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const shared = require('./shared');

let DeploymentSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  location: { type: shared.LocationSchema },
  startDate: { type: Date },
  editable: { type: Boolean },
});

let CameraSchema = new Schema({
  _id: { type: String, required: true },  // _id is serial number
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  deployments: { type: [DeploymentSchema]}
});

module.exports = mongoose.model('Camera', CameraSchema);