
const moment = require('moment');
const _ = require('lodash');
const { call } = require('./inference');
const utils = require('../db/models/utils');

const includedInView = (image, view) => {
  const filters = view.filters;

  // check camera filter
  if (filters.cameras) {
    if(!filters.cameras.includes(image.cameraSn)) {
      return false;
    }
  }
  // check label filter
  if (filters.labels) {
    const imgLabels = image.labels.map((label) => label.category);
    if (!imgLabels.length && !filters.labels.includes('none')) {
      // if the image has no labels, and filters.labels !include 'none', fail
      return false;
    }
    else {
      // else if none of the image labels are in filters.labels, fail
      const sharedLabels = _.intersection(imgLabels, filters.labels);
      if (!sharedLabels.length) {
        return false;
      }
    }
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
    if (moment(image.dateAdded).isBefore(filters.addedStart)) {
      return false;
    }
  }
  // check addedEnd
  if (filters.addedEnd) {
    if (moment(image.dateAdded).isAfter(filters.addedEnd)) {
      return false;
    }
  }
  return true;
};

const executeRule = {
  'run-inference': async (rule, image, context) => {
    try {
      const detections = await call[rule.action.model.name](image);
      // create labels
      if (detections.length) {
        detections.forEach(async (det) => {
          det.modelId = rule.action.model._id;
          await context.models.Image.createLabel(
            { imageId: image._id, label: det },
            context,
          );
        });
      }
    } catch (err) {
      throw new Error(err);
    }
  },
  'send-alert': (rule, image, models) => {
    console.log('sending alert: ', rule);
  }
};

const ruleApplies = (rule, event, label) => {
  if (rule.event === event) {
    // TODO: check whether this rule has already been run on this image
    if ((rule.event === 'label-added' && rule.label === label.category) ||
        rule.event === 'image-added') {
      return true;
    }
  }
  return false;
}

const buildCallstack = (event, image, label, views) => {
  const callstack = views.reduce((callstack, view) => {
    if (includedInView(image, view) && view.automationRules) {
      view.automationRules
        .filter((rule) => ruleApplies(rule, event, label))
        .forEach((rule) => {
          // must convert mongoose doc to js object to get de-dupe to work
          rule = rule.toObject({ flattenMaps: true });
          callstack.push(rule);
        });
    }
    return callstack;
  }, []);
  return _.uniqWith(callstack, _.isEqual); // remove dupes
};

const initiate = async (payload, context) => {
  const { event, image, label } = payload;
  const views = await context.models.View.getViews();
  let callstack = buildCallstack(event, image, label, views);
  if (callstack.length) {
    callstack.forEach(async (rule) => {
      await executeRule[rule.action.type](rule, image, context);
    });
  }
};

module.exports = {
  initiate,
};
