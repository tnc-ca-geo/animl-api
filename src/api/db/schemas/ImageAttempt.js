import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ImageErrorSchema } from './ImageError.js';

const Schema = mongoose.Schema;

/*
 * ImageMetadataSchema - for storing pre-validated image metadata in ImageAttempt documents
 *    _id - "<project_id>:<image_hash>"
 *    userSetData  - user configured EXIF data
 */

const ImageMetadataSchema = new Schema({
  _id: { type: String, required: true },
  bucket: { type: String },
  batchId: { type: String },
  fileTypeExtension: { type: String },
  dateAdded: { type: Date },
  dateTimeOriginal: { type: Date },
  timezone: { type: String },
  make: { type: String },
  cameraId: { type: String },
  originalFileName: { type: String },
  imageWidth: { type: Number },
  imageHeight: { type: Number },
  imageBytes: { type: Number },
  mimeType: { type: String },
  model: { type: String }
});

/*
 * ImageAttemptSchema - for registering image ingestion attempts
 *    _id - "<project_id>:<image_hash>"
 */

const ImageAttemptSchema = new Schema({
  _id: { type: String, required: true, default: randomUUID },
  projectId: { type: String, required: true, ref: 'Project' },
  batch: { type: String },
  created: { type: Date, default: Date.now, required: true },
  metadata: { type: ImageMetadataSchema }
});

ImageAttemptSchema.index({ batch: 1 });

ImageAttemptSchema.on('index', (e) => {
  console.log('ImageAttempt Indexing Error', e);
});

export default mongoose.model('ImageAttempt', ImageAttemptSchema);
