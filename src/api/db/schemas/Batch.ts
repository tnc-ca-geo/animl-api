import mongoose from 'mongoose';
import MongoPaging from 'mongo-cursor-pagination';

const Schema = mongoose.Schema;

const BatchSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  projectId: { type: String, required: true },
  user: { type: String },
  created: { type: Date, default: Date.now },
  overrideSerial: { type: String },
  uploadedFile: { type: String },
  originalFile: { type: String },
  uploadComplete: { type: Date }, /* Step 1 complete - Zip file has been fully received and validated */
  processingStart: { type: Date }, /* Step 2 complete - Cloudformation stack has been deployed */
  ingestionComplete: { type: Date }, /* Step 3 complete - All files have been saved to DB */
  processingEnd: { type: Date }, /* Step 4 complete - All files have been saved to DB */
  stoppingInitiated: { type: Date },
  total: { type: Number }
});
type BatchSchema = mongoose.InferSchemaType<typeof BatchSchema>;

BatchSchema.plugin(MongoPaging.mongoosePlugin);

export default mongoose.model('Batch', BatchSchema);
