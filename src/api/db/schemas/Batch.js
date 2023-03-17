const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BatchSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  eTag: { type: String },
  processingStart: { type: Date },
  processingEnd: { type: Date },
  total: { type: Number }
});

module.exports = mongoose.model('Batch', BatchSchema);
