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
  // TODO: add dateTimeUTC field
  make: { type: String, default: 'unknown', required: true },
  cameraId: { type: String, required: true, ref: 'Camera' },
  deployment: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true },
  project: { type: String, required: true, ref: 'Project' },
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
  // TODO: not sure we really need to index by cameraId if we're indexing by 
  // deployment. Also, currently we're sorting date in decending order (-1), 
  // (newest images first) but the front end is requesting oldest first by 
  // default. Also we should update this when we add dateTimeUTC field. 
  { cameraId: 1, dateTimeOriginal: -1 },
  { unique: true, sparse: true }
);
ImageSchema.index({ deployment: 1 });
ImageSchema.index({ project: 1 });

ImageSchema.on('index', (e) => {
  console.log('Indexing error', e);
});

ImageSchema.plugin(MongoPaging.mongoosePlugin);

module.exports = mongoose.model('Image', ImageSchema);