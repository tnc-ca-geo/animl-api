import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';

const Schema = mongoose.Schema;

const BatchSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  projectId: { type: String, required: true },
  user: { type: String },
  overrideSerial: { type: String },
  uploadedFile: { type: String },
  originalFile: { type: String },
  uploadComplete: { type: Date },
  ingestionComplete: { type: Date },
  processingStart: { type: Date },
  processingEnd: { type: Date },
  total: { type: Number }
});

BatchSchema.on('index', (e) => {
  console.log('Batch Indexing Error', e);
});

BatchSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Batch', BatchSchema);
