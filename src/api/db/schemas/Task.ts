import mongoose, { Types } from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';

const Schema = mongoose.Schema;

const TaskSchema = new Schema({
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

export default mongoose.model<Task>('Task', TaskSchema);

// The `type` property of the TaskSchema seems to be causing problems with the automatic
// type generation, so we manually create our own type.
interface Task {
  _id: string;
  user: string;
  projectId: string;
  type:
    | 'GetStats'
    | 'ExportAnnotations'
    | 'ExportImageErrors'
    | 'CreateDeployment'
    | 'UpdateDeployment'
    | 'DeleteDeployment';
  status: 'SUBMITTED' | 'RUNNING' | 'FAIL' | 'COMPLETE';
  created: Date;
  updated: Date;
  output: any;
}
