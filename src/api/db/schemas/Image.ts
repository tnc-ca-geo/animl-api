import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';
import { LocationSchema, ObjectSchema } from './shared/index.js';

const Schema = mongoose.Schema;

/*
 * ImageSchema
 *    _id - "<project_id>:<image_hash>"
 *    userSetData  - user configured EXIF data
 */

const ImageCommentSchema = new Schema({
  author: { type: String, required: true },
  created: { type: Date, default: Date.now, required: true },
  comment: { type: String, required: true },
});

const ImageSchema = new Schema({
  _id: { type: String, required: true },
  bucket: { type: String, required: true },
  batchId: { type: String },
  fileTypeExtension: { type: String, required: true },
  path: { type: String },
  dateAdded: { type: Date, default: Date.now, required: true },
  dateTimeOriginal: { type: Date, required: true },
  timezone: { type: String, required: true },
  make: { type: String, default: 'unknown', required: true },
  cameraId: { type: String, required: true, ref: 'Camera' },
  deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true },
  projectId: { type: String, required: true, ref: 'Project' },
  originalFileName: { type: String },
  imageWidth: { type: Number },
  imageHeight: { type: Number },
  imageBytes: { type: Number },
  mimeType: { type: String },
  userSetData: { type: Map, of: String },
  model: { type: String },
  location: { type: LocationSchema },
  triggerSource: { type: String },
  reviewed: { type: Boolean },
  objects: { type: [ObjectSchema] },
  comments: { type: [ImageCommentSchema] },
});

ImageSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Image', ImageSchema);
