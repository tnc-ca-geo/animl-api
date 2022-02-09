const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let PointSchema = new Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true },
});

let LocationSchema = new Schema({
  geometry: { type: PointSchema, required: true },
  altitude: { type: String },
  name: { type: String },
  // azimuth: { type: Number },
});

/*
 * ValidationSchema
 *    validated - the prediction was validated by a user (null = not validated,
 *                true = correct prediction, false = incorrect prediction)
 */

let ValidationSchema = new Schema({
  validated: { type: Boolean, default: false, required: true },
  validationDate: { type: Date, default: Date.now, required: true },
  userId: { type: String },
});

/*
 * LabelSchema
 *    category - the actual label (e.g. "skunk")
 *    conf - confidence of prediction
 *    bbox - [x, y, boxWidth, boxHeight], normalized
 */

let LabelSchema = new Schema({
  type: { type: String, enum: ['manual', 'ml'], requried: true },
  category: { type: String, default: 'none', required: true },
  conf: { type: Number },
  bbox: { type: [Number] },
  labeledDate: { type: Date, default: Date.now, required: true },
  validation: { type: ValidationSchema },
  // NEW - now using model name as ID and updated 'model' to 'mlModel'
  mlModel: { type: 'String', ref: 'Model' }, // if type === 'ml'
  mlModelVersion: { type: 'String' }, // NEW
  userId: { type: String }, // if type === 'manual'
});

/*
 * ObjectSchema
 *    bbox - [x, y, boxWidth, boxHeight], normalized
 *    locked - a user has reviewed the labels and validated at least one. 
 *             The most recently added validated label is considered the most 
 *             accurate. No single-click editing of catagory or bbox allowed 
 *             unless first unlocked.
 */

let ObjectSchema = new Schema({
  bbox: { type: [Number], required: true },
  locked: { type: Boolean, default: false, required: true },
  labels: { type: [LabelSchema] },
});

module.exports = {
  PointSchema,
  LocationSchema,
  LabelSchema,
  ObjectSchema,
};
