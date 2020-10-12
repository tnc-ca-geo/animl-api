const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let CameraSchema = new Schema({
  _id: { type: String, required: true },  // _id is serial number
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
});

module.exports = mongoose.model('Camera', CameraSchema);