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
      'DeleteCamera',
      'DeleteProjectLabel',
      'SetTimestampOffsetBatch',
      'SetTimestampOffsetByFilter',
    ],
  },
  status: {
    type: String,
    required: true,
    enum: ['SUBMITTED', 'RUNNING', 'FAIL', 'COMPLETE'],
    default: 'SUBMITTED',
  },
  // Task-type-specific payload. Persisted (rather than only sent in the SQS message) so it isn't
  // subject to SQS's 256KB body limit. Dates are stored tagged; see serializeConfig().
  config: { type: Object },
  created: { type: Date, default: Date.now, required: true },
  updated: { type: Date, default: Date.now, required: true },
  // Liveness signal. A Lambda timeout kills the handler before it can mark the Task FAIL, so the
  // sweeper uses this to find Tasks that died mid-flight.
  heartbeat: { type: Date, default: Date.now, required: true },
  output: { type: Object },
});

TaskSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Task', TaskSchema);

export type TaskSchema = mongoose.InferSchemaType<typeof TaskSchema>;
