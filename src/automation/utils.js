const moment = require('moment');
const _ = require('lodash');

const includedInView = (image, view) => {
  const filters = view.filters;

  // check camera filter
  if (filters.cameras) {
    if (!filters.cameras.includes(image.cameraSn)) return false;
  }

  // NEW - check deployments filter
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

  // NEW - check reviewed filter
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

  // TODO: check custom - not sure we'll ever be able to evaluate custom filters

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
  console.log(`automation.buildCallstack() - payload: ${payload}`);
  const { event, image, label } = payload;
  // NEW - updated this to use context.models.Project to get views
  const proj = await context.models.Project.getProject([payload.image.project]);
  let callstack = proj.views.reduce((applicableRules, view) => {
    if (includedInView(image, view) && view.automationRules.length > 0) {
      view.automationRules
        .filter((rule) => ruleApplies(rule, event, label))
        .forEach((rule) => applicableRules.push(rule));
    }
    return applicableRules;
  }, []);
  return _.uniqWith(callstack, _.isEqual); // remove dupes
};

module.exports = {
  buildCallstack,
};
