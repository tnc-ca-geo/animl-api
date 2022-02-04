const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let AutomationRuleSchema = new Schema({
  name: { type: String, required: true },
  event: {
    type: { type: String, enum: ['image-added', 'label-added'], required: true },
    label: { type: String },
  },
  action: {
    type: { type: String, enum: ['run-inference', 'send-alert'], required: true },
    // NEW - now using model name as ID and updated 'model' to 'mkModel'
    mlModel: { type: String, ref: 'MLModel' },
    alertRecipients: { type: [String] },
  },
});

let FiltersSchema = new Schema({
  cameras: { type: [String], default: undefined },
  deployments: { type: [String], default: undefined },
  labels: { type: [String], default: undefined },
  createdStart: { type: Date },
  createdEnd: { type: Date },
  addedStart: { type: Date },
  addedEnd: { type: Date },
  reviewed: { type: Boolean },
  custom: { type: String },
});

let ViewSchema = new Schema({
  name: { type: String, required: true },
  filters: { type: FiltersSchema, required: true },
  description: { type: String },
  editable: { type: Boolean },
  automationRules: { type: [AutomationRuleSchema] }
});

module.exports = mongoose.model('View', ViewSchema);