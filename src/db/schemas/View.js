const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let AutomationActionSchema = new Schema({
  type: { type: String, enum: ['run-inference', 'send-alert'], required: true },
  // reference model record
  // think about how what we need to actually request inference from models. 
  // might not need to save a ton of info in DB. 
  // model: { type: String, enum: ['megadetector', 'mira'] }
  // alertRecipient: ...
});

let AutomationRuleSchema = new Schema({
  event: { type: String, enum: ['image-added', 'label-added'], required: true },
  action: { type: AutomationActionSchema, required: true },
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