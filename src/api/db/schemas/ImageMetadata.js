import mongoose from 'mongoose';

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
  userSetData: { type: Map, of: String },
  model: { type: String },
  triggerSource: { type: String }
});

export default mongoose.model('ImageMetadata', ImageMetadataSchema);
