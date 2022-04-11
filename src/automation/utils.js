const moment = require('moment');
const _ = require('lodash');

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

const includedInView = (image, view) => {
  const filters = view.filters;
  // check camera filter
  if (filters.cameras) {
    if (!filters.cameras.includes(image.cameraId)) return false;
  }

  // check deployments filter
  if (filters.deployments) {
    if (!filters.deployments.includes(image.deployment)) return false;
  }

  // check label filter
  if (filters.labels) {
    let imgLabels = [];
    for (const obj of image.objects) {
      const labels = obj.labels.map((label) => label.category);
      imgLabels = imgLabels.concat(labels);
    }
    if (!imgLabels.length && !filters.labels.includes('none')) {
      // if the image has no labels, and filters.labels !include 'none', fail
      return false;
    }
    else {
      // else if none of the image labels are in filters.labels, fail
      const sharedLabels = _.intersection(imgLabels, filters.labels);
      if (!sharedLabels.length) return false;
    }
  }

  // check reviewed filter
  if (filters.reviewed === 'false') {
    // if the image has all locked objects, fail
    if (image.objects.every((obj) => obj.locked)) return false;
  }

  // check createdStart filter
  if (filters.createdStart) {
    if (moment(image.dateTimeOriginal).isBefore(filters.createdStart)) {
      return false;
    }
  }

  // check createdEnd filter
  if (filters.createdEnd) {
    if (moment(image.dateTimeOriginal).isAfter(filters.createdEnd)) {
      return false;
    }
  }

  // check addedStart filter
  if (filters.addedStart) {
    if (moment(image.dateAdded).isBefore(filters.addedStart)) return false;
  }

  // check addedEnd
  if (filters.addedEnd) {
    if (moment(image.dateAdded).isAfter(filters.addedEnd)) return false;
  }

  // TODO: check custom filter
  // this might be tough because I don't know how to evaluate whether an
  // image would match a MongoDB query outside of the DB.

  return true;
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
}

const buildCallstack = async (payload, context) => {
  console.log(`automation.buildCallstack() - payload: ${JSON.stringify(payload)}`);
  const { event, image, label } = payload;
  const projects = await context.models.Project.getProjects([image.project]);
  const proj = projects[0];
  let callstack = [];

  callstack = proj.views.reduce((applicableRules, view) => {
    const imageIncInView = includedInView(image, view);
    if (imageIncInView && view.automationRules.length > 0) {
      view.automationRules
        .filter((rule) => ruleApplies(rule, event, label))
        .forEach((rule) => applicableRules.push(rule));
    }
    return applicableRules;
  }, []);

  console.log(`automation.buildCallstack() - callstack: ${JSON.stringify(callstack)}`);

  return _.uniqWith(callstack, _.isEqual); // remove dupes
};

module.exports = {
  buildCatConfig,
  buildCallstack,
};
