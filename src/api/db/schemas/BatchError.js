const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BatchErrorSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  batch: { type: String, required: true },
  created: { type: Date, required: true },
  error: { type: String, required: true }
});

BatchErrorSchema.index({ batch: 1 });

BatchErrorSchema.on('index', (e) => {
  console.log('BatchError Indexing Error', e);
});

module.exports = mongoose.model('BatchError', BatchErrorSchema);