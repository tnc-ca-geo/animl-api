import mongoose from 'mongoose';
import { InferSchemaTypeWithDateTime } from "../utils.js";

const Schema = mongoose.Schema;

const PointSchema = new Schema({
  type: { type: String, enum: ['Point'], required: true },
  coordinates: { type: [Number], required: true }
});
export type PointSchema = InferSchemaTypeWithDateTime<typeof PointSchema>;

const LocationSchema = new Schema({
  geometry: { type: PointSchema, required: true },
  altitude: { type: String },
  name: { type: String },
  // azimuth: { type: Number },
});
export type LocationSchema = InferSchemaTypeWithDateTime<typeof LocationSchema>;

/*
 * ValidationSchema
 *    validated - the prediction was validated by a user (null = not validated,
 *                true = correct prediction, false = incorrect prediction)
 */

const ValidationSchema = new Schema({
  validated: { type: Boolean, default: false, required: true },
  validationDate: { type: Date, default: Date.now, required: true },
  userId: { type: String }
});
export type ValidationSchema = InferSchemaTypeWithDateTime<
  typeof ValidationSchema
>;

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
  userId: { type: String } // if type === 'manual'
});
export type LabelSchema = InferSchemaTypeWithDateTime<typeof LabelSchema>;

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
export type ObjectSchema = InferSchemaTypeWithDateTime<typeof ObjectSchema>;

export {
  PointSchema,
  LocationSchema,
  LabelSchema,
  ObjectSchema
};
