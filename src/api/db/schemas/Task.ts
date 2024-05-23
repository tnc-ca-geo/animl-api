import { Schema, model } from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';
import { InferSchemaTypeWithDateTime } from "./utils.js";

const TaskSchema = new Schema({
  user: { type: String, required: true },
  projectId: { type: String, required: true, ref: "Project" },
  type: {
    type: String,
    required: true,
    enum: [
      "GetStats",
      "ExportAnnotations",
      "ExportImageErrors",
      "CreateDeployment",
      "UpdateDeployment",
      "DeleteDeployment",
    ],
  },
  status: {
    type: String,
    required: true,
    enum: ["SUBMITTED", "RUNNING", "FAIL", "COMPLETE"],
    default: "SUBMITTED",
  },
  created: { type: Date, default: Date.now, required: true },
  updated: { type: Date, default: Date.now, required: true },
  output: { type: Object },
});
export type TaskSchema = InferSchemaTypeWithDateTime<typeof TaskSchema>;

TaskSchema.plugin(MongoPaging.mongoosePlugin);

export default model<TaskSchema>('Task', TaskSchema);
