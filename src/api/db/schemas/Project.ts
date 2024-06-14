import mongoose from 'mongoose';
import { LocationSchema } from './shared/index.js';
import { randomUUID } from 'node:crypto';

const Schema = mongoose.Schema;

const AutomationRuleSchema = new Schema({
  name: { type: String, required: true },
  event: {
    type: {
      type: String,
      enum: ['image-added', 'label-added'],
      required: true,
    },
    label: { type: String },
  },
  action: {
    type: {
      type: String,
      enum: ['run-inference', 'send-alert'],
      required: true,
    },
    alertRecipients: { type: [String] },
    mlModel: { type: String, ref: 'MLModel' },
    categoryConfig: {
      type: Map,
      of: new Schema({
        confThreshold: { type: Number },
        disabled: { type: Boolean },
      }),
    },
  },
});

const FiltersSchema = new Schema({
  cameras: { type: [String], default: undefined },
  deployments: { type: [String], default: undefined },
  labels: { type: [String], default: undefined },
  createdStart: { type: Date },
  createdEnd: { type: Date },
  addedStart: { type: Date },
  addedEnd: { type: Date },
  reviewed: { type: Boolean },
  notReviewed: { type: Boolean },
  custom: { type: String },
});

const ViewSchema = new Schema({
  name: { type: String, required: true },
  filters: { type: FiltersSchema, required: true },
  description: { type: String },
  editable: { type: Boolean },
});

const DeploymentSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  location: { type: LocationSchema },
  timezone: { type: String, required: true },
  startDate: { type: Date },
  editable: { type: Boolean },
});

const ProjectLabelSchema = new Schema({
  _id: { type: String, required: true, default: randomUUID },
  name: { type: String, required: true },
  color: { type: String, required: true },
  reviewerEnabled: { type: Boolean, required: true, default: true },
});

const CameraConfigSchema = new Schema({
  _id: { type: String, required: true } /* _id is serial number */,
  deployments: { type: [DeploymentSchema] },
});

const ProjectSchema = new Schema({
  _id: { type: String, required: true } /* _id is name in_snake_case */,
  name: { type: String, required: true },
  timezone: { type: String, default: 'America/Los_Angeles', required: true },
  description: { type: String },
  views: { type: [ViewSchema], required: true },
  cameraConfigs: { type: [CameraConfigSchema] },
  availableMLModels: { type: [{ type: String, ref: 'MLModel' }] },
  automationRules: { type: [AutomationRuleSchema] },
  labels: {
    type: [ProjectLabelSchema],
    default: [
      {
        _id: 'empty',
        name: 'empty',
        color: '#8D8D8D',
      },
      {
        _id: 'unknown',
        name: 'unknown',
        color: '#E93D82',
      },
    ],
    required: true,
  },
});

export default mongoose.model('Project', ProjectSchema);

export type ProjectSchema = mongoose.InferSchemaType<typeof ProjectSchema>;
export type ViewSchema = mongoose.InferSchemaType<typeof ViewSchema>;
