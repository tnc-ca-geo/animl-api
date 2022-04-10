const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let ProjectRegistrationSchema = new Schema({
  project: { type: String, default: 'default_project', required: true },
  active: { type: Boolean, required: true },
});

let CameraSchema = new Schema({
  _id: { type: String, required: true },  // _id is serial number
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  projRegistrations: { type: [ProjectRegistrationSchema] },
});

module.exports = mongoose.model('Camera', CameraSchema);