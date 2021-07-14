const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let DeploymentSchema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  location: { type: shared.LocationSchema },
  endDate: { type: Date },
});

let CameraSchema = new Schema({
  _id: { type: String, required: true },  // _id is serial number
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  deployments: { type: [DeploymentSchema]}
});

module.exports = mongoose.model('Camera', CameraSchema);