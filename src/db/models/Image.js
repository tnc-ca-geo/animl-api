const mongoose = require('mongoose');
const shared = require('./shared');
const Schema = mongoose.Schema;

/*
 * ValidationSchema
 * reviewed - has the image been reviewed by a user
 * validated - the prediction was validated by a user
 *            (true = correct prediction, false = incorrect prediction)
 */

let ValidationSchema = new Schema({
  reviewed: { type: Boolean, default: false, required: true },
  validated: { type: Boolean, default: false, required: true },
  reviewDate: { type: Date },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
});

/*
 * LabelSchema
 * conf - confidence of prediction
 * bbox - [x, y, boxWidth, boxHeight], normalized
 */

let LabelSchema = new Schema({
  type: { type: String, enum: ['manual', 'ml'], requried: true },
  category: { type: String, default: 'none', required: true },
  conf: { type: Number },
  bbox: { type: [Number] },
  labeledDate: { type: Date, default: Date.now, required: true },
  validation: { type: ValidationSchema, requried: true },
  model: { type: Schema.Types.ObjectId, ref: 'Model' },
  // might need to add a field for user if it's a manual label
});

/*
 * ImageSchema
 * filePath  - rel path to image accessible to front end via cloudfront distro
 * objectKey - to find image in s3
 * userSetData  - user configured EXIF data
 */

let ImageSchema = new Schema({
  hash: { type: String, required: true },
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
  labels: { type: [LabelSchema] },
  // deployment: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'Deployment',
  // },
});

ImageSchema.index(
  { 'cameraSn': 1, dateTimeOriginal: -1 },
  { unique: true, sparse: true }
);

// ImageSchema.index({ deployment: 1 });

ImageSchema.on('index', (e) => {
  console.log('Indexing error', e);
});

module.exports = mongoose.model('Image', ImageSchema);