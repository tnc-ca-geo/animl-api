const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const shared = require('./shared');

const FiltersSchema = new Schema({
  batches: { type: [String], default: undefined },
  processingStart: { type: Date },
  processingEnd: { type: Date }
});

const BatchSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  processingStart: { type: Date },
  processingEnd: { type: Date },
  total: { type: Number }
});

module.exports = mongoose.model('Batch', BatchSchema);
