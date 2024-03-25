import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';

const Schema = mongoose.Schema;

const TaskSchema = new Schema({
  user: { type: String, required: true },
  projectId: { type: String, required: true, ref: 'Project' },
  type: {
    type: String,
    required: true,
    enum : ['GetStats', 'AnnotationsExport', 'ImageErrorsExport']
  },
  status: {
    type: String,
    required: true,
    enum : ['SUBMITTED', 'RUNNING', 'FAIL', 'COMPLETE'],
    default: 'SUBMITTED'
  },
  created: { type: Date, default: Date.now, required: true },
  updated: { type: Date, default: Date.now, required: true },
  output: { type: Object }
});

TaskSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Task', TaskSchema);
