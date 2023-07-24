import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';

const Schema = mongoose.Schema;

const BatchSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  projectId: { type: String, required: true },
  user: { type: String },
  eTag: { type: String },
  overrideSerial: { type: String },
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

export default mongoose.model('Batch', BatchSchema);
