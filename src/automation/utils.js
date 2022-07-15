const _ = require('lodash');
const { buildFilter } = require('../api/db/models/utils');
const Image = require('../api/db/schemas/Image');


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

const includedInView = async (image, view, projectId) => {
    // NOTE: we moved away from manually trying to evaluate whether an image's
    // in-memory JSON representation would be included in a view to actually
    // querying for the real image in the DB (this is possible b/c in the context
    // of either automation event types - "image-added" or "label-added" - the
    // image should have already been saved before we handle the event.

    // Alternatively, Sift.js (https://github.com/crcn/sift.js) sounds very
    // promising but wouldn't work if we move to aggregation-pipeline-based querying

    // Another option would be to break the automation rule handling into it's own
    // service/lambda so that we can trigger it and return from mutation resolver
    // without waiting for the callstack to be built and executed.

    console.log('includedInView() - firing');
    const viewQuery = buildFilter(view.filters, projectId);
    const query = { _id: image._id, ...viewQuery };
    console.log('includedInView() - query: ', query);
    const res = await Image.find(query);
    console.log('includedInView() - res: ', res);
    return res.length > 0;
};

const ruleApplies = (rule, event, label) => {
    if (rule.event.type === event) {
    // TODO: check whether this rule has already been run on this image
        if ((rule.event.type === 'label-added' &&
        rule.event.label === label.category) ||
        rule.event.type === 'image-added') {
            return true;
        }
    }
    return false;
};

const buildCallstack = async (payload, context) => {
    const { event, image, label } = payload;
    const [project] = await context.models.Project.getProjects([image.projectId]);

    let callstack = [];
    for (const view of project.views) {
        console.log('buildCallstack() - checking view: ', view);
        const imageIncInView = await includedInView(image, view, project._id);
        console.log('buildCallstack() - imageIncInView: ', imageIncInView);
        if (imageIncInView && view.automationRules.length > 0) {
            view.automationRules
                .filter((rule) => ruleApplies(rule, event, label))
                .forEach((rule) => callstack.push(rule));
        }
    }

    // remove dupes
    // BUG: this no longer works, b/c automation rules have unique _id fields,
    // the name fields for automation rule might differ, and category configs
    // nested documents also have their own _id fields. I think the ultimate
    // solution will be to move automation rules from the view level to the
    // project level: https://github.com/tnc-ca-geo/animl-api/issues/50
    callstack = _.uniqWith(callstack, _.isEqual);
    console.log('buildCallstack() - callstack: ', callstack);

    return callstack;
};

module.exports = {
    buildCatConfig,
    buildCallstack
};
