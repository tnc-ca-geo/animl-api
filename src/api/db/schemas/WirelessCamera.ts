import { Schema, model } from 'mongoose';
import { InferSchemaTypeWithDateTime } from "./utils.js";

const ProjectRegistrationSchema = new Schema({
  projectId: { type: String, default: 'default_project', required: true },
  active: { type: Boolean, required: true }
});
export type ProjectRegistration = InferSchemaTypeWithDateTime<
  typeof ProjectRegistrationSchema
>;

const WirelessCameraSchema = new Schema({
  _id: { type: String, required: true },  // _id is serial number
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  projRegistrations: { type: [ProjectRegistrationSchema] }
}, { collection: 'wirelesscameras' });
export type WirelessCameraSchema = InferSchemaTypeWithDateTime<
  typeof WirelessCameraSchema
>;

export default model<WirelessCameraSchema>('WirelessCameraSchema', WirelessCameraSchema);
