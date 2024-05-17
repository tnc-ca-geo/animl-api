import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { InferSchemaTypeWithDateTime } from "./utils.js";

const Schema = mongoose.Schema;

const BatchErrorSchema = new Schema({
  _id: { type: String, default: randomUUID, required: true },  /* _id is name in_snake_case */
  batch: { type: String, required: true },
  created: { type: Date, default: Date.now, required: true },
  error: { type: String, required: true }
});
type BatchErrorSchema = InferSchemaTypeWithDateTime<typeof BatchErrorSchema>;

export default mongoose.model('BatchError', BatchErrorSchema);