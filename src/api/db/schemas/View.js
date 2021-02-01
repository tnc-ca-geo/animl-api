const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let AutomationRuleSchema = new Schema({
  event: {
    type: { type: String, enum: ['image-added', 'label-added'], required: true },
    label: { type: String },
  },
  action: {
    type: { type: String, enum: ['run-inference', 'send-alert'], required: true },
    // TODO: rename this modelId
    model: { type: Schema.Types.ObjectId, ref: 'Model' },
    alertRecipient: { type: String },
  },
});

let FiltersSchema = new Schema({
  cameras: { type: [String], default: undefined },
  labels: { type: [String], default: undefined },
  createdStart: { type: Date },
  createdEnd: { type: Date },
  addedStart: { type: Date },
  addedEnd: { type: Date },
});

let ViewSchema = new Schema({
  name: { type: String, required: true },
  filters: { type: FiltersSchema, required: true },
  description: { type: String },
  editable: { type: Boolean },
  automationRules: { type: [AutomationRuleSchema]}
});

module.exports = mongoose.model('View', ViewSchema);