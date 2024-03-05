import mongoose from 'mongoose';
const Schema = mongoose.Schema;

const ProjectRegistrationSchema = new Schema({
  projectId: { type: String, default: 'default_project', required: true },
  active: { type: Boolean, required: true }
});

const WirelessCameraSchema = new Schema({
  _id: { type: String, required: true },  // _id is serial number
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  projRegistrations: { type: [ProjectRegistrationSchema] }
}, { collection: 'wirelesscameras' });

export default mongoose.model('WirelessCameraSchema', WirelessCameraSchema);
