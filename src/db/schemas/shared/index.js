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

/*
 * ValidationSchema
 * reviewed - has the image been reviewed by a user
 * validated - the prediction was validated by a user
 *            (true = correct prediction, false = incorrect prediction)
 */

let ValidationSchema = new Schema({
  reviewed: { type: Boolean, default: false, required: true },
  validated: { type: Boolean, default: false, required: true },
  reviewDate: { type: Date },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
});

/*
 * LabelSchema
 * category - the actual label (e.g. "skunk")
 * conf - confidence of prediction
 * bbox - [x, y, boxWidth, boxHeight], normalized
 */

let LabelSchema = new Schema({
  type: { type: String, enum: ['manual', 'ml'], requried: true },
  category: { type: String, default: 'none', required: true },
  conf: { type: Number },
  bbox: { type: [Number] },
  labeledDate: { type: Date, default: Date.now, required: true },
  validation: { type: ValidationSchema, requried: true },
  model: { type: Schema.Types.ObjectId, ref: 'Model' },
  // might need to add a field for user if it's a manual label
  // user: { type: Schema.Types.ObjectId, ref: 'User' },
});

module.exports = {
  PointSchema,
  LocationSchema,
  LabelSchema,
};
