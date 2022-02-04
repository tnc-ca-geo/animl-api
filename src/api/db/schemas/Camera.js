const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const shared = require('./shared');

// let DeploymentSchema = new Schema({
//   name: { type: String, required: true },
//   description: { type: String },
//   location: { type: shared.LocationSchema },
//   timezone: { type: String, required: true }, // NEW
//   startDate: { type: Date },
//   editable: { type: Boolean },
// });

// NEW
let ProjectRegistrationSchema = new Schema({
  project: { type: String, default: 'default', required: true },
  active: { type: Boolean, requried: true },
});

let CameraSchema = new Schema({
  _id: { type: String, required: true },  // _id is serial number
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  projectRegistrations: { type: [ProjectRegistrationSchema] }, // NEW
  // deployments: { type: [DeploymentSchema]} // NEW - removed! moving deps to Project.CameraConfig
});

module.exports = mongoose.model('Camera', CameraSchema);