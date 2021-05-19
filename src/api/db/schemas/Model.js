const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/*
 * ModelPerformanceSchema
 * invocationCount - number of times the model has been invoked
 * correctCount  - number of times a reviewer validated the prediciton
 * incorrectCount - number of times a reviewer invalidated the prediciton
 */

// TODO: think about measuring model performance a bit more...
let ModelPerformanceSchema = new Schema({
  invocationCount: { type: Number, required: true, default: 0 },
  validationCcount: { type: Number, required: true, default: 0 },
  invalidationCount: { type: Number, required: true, default: 0 },
});

/*
 * ModelSchema
 * renderThreshold  - if set, only keep predictions with confidence above thresh
 * catagories - map of catagory ids to labels (e.g. {0: 'empty', 1: 'animal'})
 */

// TODO: Come up with better name than 'Model'? Too confusing
let ModelSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  version: { type: String, required: true },
  renderThreshold: { type: Number },
  categories: { type: Map },
  // performance: { type: ModelPerformanceSchema, required: true },
});

ModelSchema.index(
  { name: 1, version: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('Model', ModelSchema);
