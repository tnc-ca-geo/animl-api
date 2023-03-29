const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ImageErrorSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  image: { type: String },
  batch: { type: String },
  created: { type: Date, required: true },
  error: { type: String, required: true }
});

ImageErrorSchema.index({ batch: 1 });

ImageErrorSchema.on('index', (e) => {
  console.log('ImageError Indexing Error', e);
});

module.exports = mongoose.model('ImageError', ImageErrorSchema);