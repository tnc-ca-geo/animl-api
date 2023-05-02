const mongoose = require('mongoose');
const MongoPaging = require('mongo-cursor-pagination');
const Schema = mongoose.Schema;

const BatchSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  projectId: { type: String, required: true },
  user: { type: String },
  eTag: { type: String },
  uploadedFile: { type: String },
  originalFile: { type: String },
  processingStart: { type: Date },
  processingEnd: { type: Date },
  total: { type: Number }
});

BatchSchema.index({ eTag: 1 });

BatchSchema.on('index', (e) => {
  console.log('Batch Indexing Error', e);
});

BatchSchema.plugin(MongoPaging.mongoosePlugin);

module.exports = mongoose.model('Batch', BatchSchema);
