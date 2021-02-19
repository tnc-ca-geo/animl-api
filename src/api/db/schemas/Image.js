const mongoose = require('mongoose');
const MongoPaging = require('mongo-cursor-pagination');
const shared = require('./shared');
const Schema = mongoose.Schema;

/*
 * ImageSchema
 * filePath  - rel path to image accessible to front end via cloudfront distro
 * objectKey - to find image in s3
 * userSetData  - user configured EXIF data
 */

let ImageSchema = new Schema({
  hash: { type: String, required: true }, // TODO: should hash be the _id?
  bucket: { type: String, required: true },
  objectKey: { type: String, required: true },
  dateAdded: { type: Date, default: Date.now, required: true },
  dateTimeOriginal: { type: Date, required: true },
  originalFileName: { type: String },
  imageWidth: { type: Number },
  imageHeight: { type: Number },
  mimeType: { type: String },
  userSetData: { type: Map, of: String },
  // ref property allows us to use populate()
  // https://mongoosejs.com/docs/populate.html
  cameraSn: { type: String, required: true, ref: 'Camera' },
  make: { type: String, default: 'unknown', required: true },
  model: { type: String },
  location: { type: shared.LocationSchema },
  objects: { type: [shared.ObjectSchema] },
  // deployment: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Deployment',
  // },
});

ImageSchema.index(
  { cameraSn: 1, dateTimeOriginal: -1 },
  { unique: true, sparse: true }
);

// ImageSchema.index({ deployment: 1 });

ImageSchema.on('index', (e) => {
  console.log('Indexing error', e);
});

ImageSchema.plugin(MongoPaging.mongoosePlugin);

module.exports = mongoose.model('Image', ImageSchema);