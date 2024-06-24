import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const PointSchema = new Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true },
});

const LocationSchema = new Schema({
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

const ValidationSchema = new Schema({
  validated: { type: Boolean, default: false, required: true },
  validationDate: { type: Date, default: Date.now, required: true },
  userId: { type: String },
});

/*
 * LabelSchema
 *    conf - confidence of prediction
 *    bbox - [ymin, xmin, ymax, xmax], normalized (not absolute)
 */

const LabelSchema = new Schema({
  type: { type: String, enum: ['manual', 'ml', 'default'], required: true, default: 'manual' },
  labelId: { type: String, required: true },
  conf: { type: Number },
  bbox: { type: [Number] },
  labeledDate: { type: Date, default: Date.now, required: true },
  validation: { type: ValidationSchema },
  mlModel: { type: 'String', ref: 'Model' }, // if type === 'ml'
  mlModelVersion: { type: 'String' },
  userId: { type: String }, // if type === 'manual'
});

/*
 * ObjectSchema
 *    bbox - [ymin, xmin, ymax, xmax], normalized (not absolute)
 *    locked - a user has reviewed the labels and validated at least one.
 *             The most recently added validated label is considered the most
 *             accurate. No single-click editing of catagory or bbox allowed
 *             unless first unlocked.
 */

const ObjectSchema = new Schema({
  bbox: { type: [Number], required: true },
  locked: { type: Boolean, default: false, required: true },
  labels: { type: [LabelSchema] },
});

export { PointSchema, LocationSchema, LabelSchema, ObjectSchema };
export type LabelSchema = mongoose.InferSchemaType<typeof LabelSchema>;
