import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';

const Schema = mongoose.Schema;

const ImageAttemptSchema = new Schema({
  _id: { type: String, required: true, default: randomUUID },  /* _id is name in_snake_case */
  projectId: { type: String, required: true, ref: 'Project' },
  batch: { type: String },
  created: { type: Date, default: Date.now, required: true },
  metadata: { type: Object }
});

ImageAttemptSchema.index({ batch: 1 });

ImageAttemptSchema.on('index', (e) => {
  console.log('ImageAttempt Indexing Error', e);
});

export default mongoose.model('ImageAttempt', ImageAttemptSchema);
