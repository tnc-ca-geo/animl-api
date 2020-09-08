// Schema shared by multiple models

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PointSchema = new Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true },
});

let LocationSchema = new Schema({
  geometry: { type: PointSchema, required: true },
  altitude: { type: String },
  name: { type: String },
  // azimuth: { type: Number },
});

let CameraSchema = new Schema({
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  serialNumber: { type: String, required: true },
});

module.exports = {
  PointSchema,
  LocationSchema,
  CameraSchema,
};
