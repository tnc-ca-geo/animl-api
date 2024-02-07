// const _ = require('lodash');
// const { buildPipeline } = require('../api/db/models/utils');
// const Image = require('../api/db/schemas/Image');


const buildCatConfig = (modelSource, rule) => {
  return modelSource.categories.map((cs) => {
    const { _id, name } = cs;
    const catConfig = rule.action.categoryConfig &&
                      rule.action.categoryConfig.get(name);
    // for confidence threshold, priorize the automation rule / category-level
    // setting if it exists, else use the model source's default setting
    const ct = (catConfig && catConfig.confThreshold) ||
                modelSource.defaultConfThreshold;
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

const ruleApplies = (rule, event, label, project) => {
  if (rule.event.type === event) {
    // TODO: check whether this rule has already been run on this image
    const projectLabel = project.labels.find((pl) => pl.name.toLowerCase() === rule.event.label.toLowerCase());
    if ((rule.event.type === 'label-added' &&
        rule.event.label.toLowerCase() === projectLabel?.name.toLowerCase()) ||
        rule.event.type === 'image-added') {
      return true;
    }
  }
  return false;
};

const buildCallstack = async (payload, context) => {
  const { event, image, label } = payload;
  const [project] = await context.models.Project.getProjects({ _ids: [image.projectId] }, context);

  // let callstack = [];
  // for (const view of project.views) {
  //   const imageIncInView = await includedInView(image, view, project._id);
  //   if (imageIncInView && view.automationRules.length > 0) {
  //     view.automationRules
  //       .filter((rule) => ruleApplies(rule, event, label))
  //       .forEach((rule) => callstack.push(rule));
  //   }
  // }

  // remove dupes
  // BUG: this no longer works, b/c automation rules have unique _id fields,
  // the name fields for automation rule might differ, and category configs
  // nested documents also have their own _id fields. I think the ultimate
  // solution will be to move automation rules from the view level to the
  // project level: https://github.com/tnc-ca-geo/animl-api/issues/50
  // callstack = _.uniqWith(callstack, _.isEqual);

  const callstack = project.automationRules.filter((rule) => ruleApplies(rule, event, label, project));

  return callstack;
};

export {
  buildCatConfig,
  buildCallstack
};
