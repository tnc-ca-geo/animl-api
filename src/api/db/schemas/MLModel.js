const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
 * MLModelPerformanceSchema
 *    invocationCount - number of times the model has been invoked
 *    correctCount  - number of times a reviewer validated the prediciton
 *    incorrectCount - number of times a reviewer invalidated the prediciton
 */

// TODO: think about measuring model performance a bit more...
let MLModelPerformanceSchema = new Schema({
  invocationCount: { type: Number, required: true, default: 0 },
  validationCcount: { type: Number, required: true, default: 0 },
  invalidationCount: { type: Number, required: true, default: 0 },
});

/*
 * MLModelSchema
 *    serves as "source" for options when new automation rules are being created 
 *    and for when applying model version to labels after inference
 */

// NEW - renamed ModelSchema to MLModelsSchema
let MLModelSchema = new Schema({
  _id : { types: String, requrired: true }, // NEW - using "name" string as _id
  // name: { type: String, required: true },
  description: { type: String },
  version: { type: String, required: true },
  defaultConfThreshold: { type: Number, required: true }, // NEW
  categories: {
    type: [new Schema({
      _id: { type: String, required: true },
      name: { type: String, required: true }
    })],
    required: true,
  },
  // performance: { type: MLModelPerformanceSchema, required: true },
});

MLModelSchema.index(
  { name: 1, version: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('MLModel', MLModelSchema);
