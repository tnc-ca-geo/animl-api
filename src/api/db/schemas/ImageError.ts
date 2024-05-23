import { Schema, model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { InferSchemaTypeWithDateTime } from "./utils.js";

const ImageErrorSchema = new Schema({
  _id: { type: String, required: true, default: randomUUID },  /* _id is name in_snake_case */
  image: { type: String },
  batch: { type: String },
  created: { type: Date, default: Date.now, required: true },
  path: { type: String },
  error: { type: String, required: true }
});
type ImageErrorSchema = InferSchemaTypeWithDateTime<typeof ImageErrorSchema>;

export default model<ImageErrorSchema>('ImageError', ImageErrorSchema);
