// const _ = require('lodash');
// const { buildPipeline } = require('../api/db/models/utils');
// const Image = require('../api/db/schemas/Image');

import { Context as BaseContext, Handler } from 'aws-lambda';
import { MLModelSchema } from '../api/db/schemas/MLModel.js';
import { AutomationRuleSchema, ProjectSchema } from '../api/db/schemas/Project.js';
import { ImageSchema } from '../api/db/schemas/Image.js';
import { ProjectModel } from '../api/db/models/Project.js';
import { Config } from '../config/config.js';
import { User } from '../api/auth/authorization.js';
import { MLModelModel } from '../api/db/models/MLModel.js';

const buildCatConfig = (modelSource: MLModelSchema, rule: AutomationRuleSchema) => {
  return modelSource.categories.map((cs) => {
    const { _id, name } = cs;
    const catConfig = rule.action?.categoryConfig && rule.action?.categoryConfig.get(name);
    // for confidence threshold, priorize the automation rule / category-level
    // setting if it exists, else use the model source's default setting
    const ct = (catConfig && catConfig.confThreshold) || modelSource.defaultConfThreshold;
    const disabled = (catConfig && catConfig.disabled) || false;
    return { _id, name, disabled, confThreshold: ct };
  });
};

// const includedInView = async (image, view, projectId) => {
//   // NOTE: we moved away from manually trying to evaluate whether an image's
//   // in-memory JSON representation would be included in a view to actually
//   // querying for the real image in the DB (this is possible b/c in the context
//   // of either automation event types - "image-added" or "label-added" - the
//   // image should have already been saved before we handle the event.

//   // Alternatively, Sift.js (https://github.com/crcn/sift.js) sounds very
//   // promising but won't work know that we've moved to aggregation-pipeline-based querying

//   // Another option would be to break the automation rule handling into it's own
//   // service/lambda so that we can trigger it and return from mutation resolver
//   // without waiting for the callstack to be built and executed.

//   console.log('included in view?');
//   const viewPipeline = buildPipeline(view.filters, projectId);
//   viewPipeline.push({ $match: { _id: image._id } });
//   const res = await Image.aggregate(viewPipeline);
//   console.log('res: ', res);
//   console.log('included in view? ', res.length > 0);
//   return res.length > 0;
// };

const ruleApplies = (
  rule: AutomationRuleSchema,
  event: Payload['event'],
  label: Payload['label'],
  project: ProjectSchema,
) => {
  // TODO: check whether this rule has already been run on this image

  if (rule.event.type === event) {
    if (rule.event.type === 'image-added') {
      return true;
    }
    if (rule.event.type === 'label-added') {
      const projectLabel = project.labels.find((pl) => {
        return pl._id.toString() === label.labelId.toString();
      });

      if (rule.event.label.toLowerCase() === projectLabel?.name.toLowerCase()) {
        return true;
      }
    }
  }
  return false;
};

const buildCallstack = async (payload: Payload, context: Context) => {
  const { event, image, label } = payload;
  const [project] = await context.models.Project.getProjects({ _ids: [image.projectId] }, context);
  const callstack = project.automationRules.filter((rule) =>
    ruleApplies(rule as any as AutomationRuleSchema, event, label, project), // KLUDGE: Work around TS issues with AutomationRuleSchema type
  );
  return callstack;
};

export { buildCatConfig, buildCallstack };

interface Payload {
  event: any;
  image: ImageSchema;
  label: any;
}
export interface Context extends BaseContext {
  models: {
    Project: typeof ProjectModel;
    MLModel: typeof MLModelModel;
  };
  config: Config;
  user: User;
}