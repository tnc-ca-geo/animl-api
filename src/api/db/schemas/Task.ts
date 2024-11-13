import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';

const Schema = mongoose.Schema;

const TaskSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true },
  user: { type: String, required: true },
  projectId: { type: String, required: true, ref: 'Project' },
  type: {
    type: String,
    required: true,
    enum: [
      'GetStats',
      'ExportAnnotations',
      'ExportImageErrors',
      'CreateDeployment',
      'UpdateDeployment',
      'DeleteDeployment',
      'UpdateSerialNumber',
      'DeleteImages',
      'DeleteImagesByFilter',
    ],
  },
  status: {
    type: String,
    required: true,
    enum: ['SUBMITTED', 'RUNNING', 'FAIL', 'COMPLETE'],
    default: 'SUBMITTED',
  },
  created: { type: Date, default: Date.now, required: true },
  updated: { type: Date, default: Date.now, required: true },
  output: { type: Object },
});

TaskSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Task', TaskSchema);

export type TaskSchema = mongoose.InferSchemaType<typeof TaskSchema>;
