import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';
import {
  LocationSchema,
  ObjectSchema
} from './shared/index.js';

const Schema = mongoose.Schema;

/*
 * ImageSchema
 *    _id - "<project_id>:<image_hash>"
 *    userSetData  - user configured EXIF data
 */

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
  objects: { type: [ObjectSchema] }
});

ImageSchema.index(
  // TODO: revisit indexing. I'm not sure we really need to index by
  // cameraId if we're indexing by deployment.
  { cameraId: 1, dateTimeOriginal: -1 },
  { sparse: true }
);
ImageSchema.index({ deploymentId: 1 });
ImageSchema.index({ projectId: 1 });

ImageSchema.on('index', (e) => {
  console.log('Indexing error', e);
});

ImageSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Image', ImageSchema);
