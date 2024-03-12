import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';

const Schema = mongoose.Schema;

const TaskSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  user: { type: String, required: true },
  projectId: { type: String, required: true, ref: 'Project' },
  type: {
    type: String,
    required: true,
    enum : ['STATS']
  },
  status: {
    type: String,
    required: true,
    enum : ['SUBMITTED', 'FAIL', 'COMPLETE'],
    default: 'SUBMITTED'
  },
  config: { type: Object, default: {}, required: true },
  created: { type: Date, default: Date.now, required: true },
  updated: { type: Date, default: Date.now, required: true },
  error: { type: String },
});

TaskSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Task', TaskSchema);
