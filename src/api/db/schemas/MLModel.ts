import { Schema, model } from 'mongoose';
import { InferSchemaTypeWithDateTime } from "./utils.js";

// /*
//  * MLModelPerformanceSchema
//  *    invocationCount - number of times the model has been invoked
//  *    correctCount  - number of times a reviewer validated the prediciton
//  *    incorrectCount - number of times a reviewer invalidated the prediciton
//  */

// // TODO: think about measuring model performance a bit more...
// const MLModelPerformanceSchema = new Schema({
//   invocationCount: { type: Number, required: true, default: 0 },
//   validationCcount: { type: Number, required: true, default: 0 },
//   invalidationCount: { type: Number, required: true, default: 0 },
// });

/*
 * MLModelSchema
 *    serves as "source" for options when new automation rules are being created
 *    and for when applying model version to labels after inference
 */

const MLModelSchema = new Schema({
  _id : { type: String, required: true }, /* _id is name of ml model */
  description: { type: String },
  version: { type: String, required: true },
  defaultConfThreshold: { type: Number, required: true },
  categories: {
    type: [new Schema({
      _id: { type: String, required: true },
      name: { type: String, required: true },
      color: { type: String, required: true }
    })],
    required: true
  }
  // performance: { type: MLModelPerformanceSchema, required: true },
});
export type MLModelSchema = InferSchemaTypeWithDateTime<typeof MLModelSchema>;

export default model<MLModelSchema>('MLModel', MLModelSchema);
