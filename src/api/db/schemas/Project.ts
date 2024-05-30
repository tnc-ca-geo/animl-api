import { Schema, model } from 'mongoose';
import { LocationSchema } from './shared/index.js';
import { randomUUID } from 'node:crypto';
import { InferSchemaTypeWithDateTime } from './utils.js';

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
export type _AutomationRuleSchema = InferSchemaTypeWithDateTime<typeof AutomationRuleSchema>;
export type AutomationRuleSchema = Omit<_AutomationRuleSchema, 'action' | 'event'> & {
  // NOTE: The 'type' field of the AutomationRuleSchema causes some problems with
  // TypeScript as it interferes with the MongoDB Schema 'type' field. This is despite
  // the fact that we are using the 'type' field as instructed in the docs:
  // https://mongoosejs.com/docs/schematypes.html#type-key
  event: {
    type: 'image-added' | 'label-added';
    label: string;
  };
  action: {
    type: 'run-inference' | 'send-alert';
    alertRecipients: string[];
    mlModel: string;
    categoryConfig: Map<
      string,
      {
        confThreshold: number;
        disabled: boolean;
      }
    >;
  };
};

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
export type FiltersSchema = InferSchemaTypeWithDateTime<typeof FiltersSchema>;

const ViewSchema = new Schema({
  name: { type: String, required: true },
  filters: { type: FiltersSchema, required: true },
  description: { type: String },
  editable: { type: Boolean },
});
export type ViewSchema = InferSchemaTypeWithDateTime<typeof ViewSchema>;

const DeploymentSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  location: { type: LocationSchema },
  timezone: { type: String, required: true },
  startDate: { type: Date },
  editable: { type: Boolean },
});
export type DeploymentSchema = InferSchemaTypeWithDateTime<typeof DeploymentSchema>;

const ProjectLabelSchema = new Schema({
  _id: { type: String, required: true, default: randomUUID },
  name: { type: String, required: true },
  color: { type: String, required: true },
  reviewerEnabled: { type: Boolean, required: true, default: true },
});
export type ProjectLabelSchema = InferSchemaTypeWithDateTime<typeof ProjectLabelSchema>;

const CameraConfigSchema = new Schema({
  _id: { type: String, required: true } /* _id is serial number */,
  deployments: { type: [DeploymentSchema] },
});
export type CameraConfigSchema = InferSchemaTypeWithDateTime<typeof CameraConfigSchema>;

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
export type ProjectSchema = InferSchemaTypeWithDateTime<typeof ProjectSchema>;

export default model<ProjectSchema>('Project', ProjectSchema);
