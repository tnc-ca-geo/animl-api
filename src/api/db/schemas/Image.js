const mongoose = require('mongoose');
const MongoPaging = require('mongo-cursor-pagination');
const shared = require('./shared');
const Schema = mongoose.Schema;

/*
 * ImageSchema
 *    _id - hash of image generated in animl-ingest
 *    userSetData  - user configured EXIF data
 */

let ImageSchema = new Schema({
  _id: { type: String, required: true },
  bucket: { type: String, required: true },
  fileTypeExtension: { type: String, required: true },
  dateAdded: { type: Date, default: Date.now, required: true },
  dateTimeOriginal: { type: Date, required: true },
  make: { type: String, default: 'unknown', required: true },
  cameraSn: { type: String, required: true, ref: 'Camera' },
  deployment: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true },
  project: { type: String, required: true, ref: 'Project' },  // NEW
  originalFileName: { type: String },
  imageWidth: { type: Number },
  imageHeight: { type: Number },
  mimeType: { type: String },
  userSetData: { type: Map, of: String },
  model: { type: String },
  location: { type: shared.LocationSchema },
  objects: { type: [shared.ObjectSchema] },
});

ImageSchema.index(
  { cameraSn: 1, dateTimeOriginal: -1 },
  { unique: true, sparse: true }
);

ImageSchema.index({ deployment: 1 });

// TODO AUTH: add "project" as secondary indices

ImageSchema.on('index', (e) => {
  console.log('Indexing error', e);
});

ImageSchema.plugin(MongoPaging.mongoosePlugin);

module.exports = mongoose.model('Image', ImageSchema);