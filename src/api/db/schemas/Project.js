const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const shared = require('./shared');

let AutomationRuleSchema = new Schema({
  name: { type: String, required: true },
  event: {
    type: {
      type: String,
      enum: ['image-added', 'label-added'],
      required: true
    },
    label: { type: String },
  },
  action: {
    type: {
      type: String,
      enum: ['run-inference', 'send-alert'],
      required: true
    },
    alertRecipients: { type: [String] },
    mlModel: { type: String, ref: 'MLModel' },
    categoryConfig: {
      type: Map,
      of: new Schema({
        confThreshold: { type: Number },
        disabled: { type: Boolean },
      }),
    }
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

let DeploymentSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  location: { type: shared.LocationSchema },
  timezone: { type: String, required: true },
  startDate: { type: Date },
  editable: { type: Boolean },
});

let CameraConfigSchema = new Schema({
  _id: { type: String, required: true },  /* _id is serial number */
  deployments: { type: [DeploymentSchema]},
});

let ProjectSchema = new Schema({
  _id: { type: String, required: true },  /* _id is name in_snake_case */
  name: { type: String, required: true },
  timezone: { type: String, default: 'America/Los_Angeles', required: true },
  description: { type: String },
  views: { type: [ViewSchema], required: true },
  cameraConfigs: { type: [CameraConfigSchema]},
  availableMLModels: { type: [{ type: String, ref: 'MLModel' }] }
});

module.exports = mongoose.model('Project', ProjectSchema);