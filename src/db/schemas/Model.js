const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
 * ModelPerformanceSchema
 * invocationCount - number of times the model has been invoked
 * correctCount  - number of times a reviewer validated the prediciton
 * incorrectCount - number of times a reviewer invalidated the prediciton
 */

let ModelPerformanceSchema = new Schema({
  invocationCount: { type: Number, required: true, default: 0 },
  validationCcount: { type: Number, required: true, default: 0 },
  invalidationCount: { type: Number, required: true, default: 0 },
});

/*
 * ModelSchema
 * endpointName - name of endpoint in Sagemaker
 * renderThreshold  - if set, only keep predictions with confidence above thresh
 * catagories - map of catagory ids to labels (e.g. {0: 'empty', 1: 'animal'})
 */

let ModelSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  endpointName: { type: String, required: true },
  version: { type: String, required: true },
  renderThreshold: { type: Number },
  categories: { type: Map },
  performance: { type: ModelPerformanceSchema },
});

module.exports = mongoose.model('Model', ModelSchema);
