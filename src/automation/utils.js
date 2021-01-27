const moment = require('moment');
const _ = require('lodash');

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

const ruleApplies = (rule, event, label) => {
  if (rule.event.type === event) {
    // TODO: check whether this rule has already been run on this image
    if ((rule.event.type === 'label-added' && rule.event.label === label.category) ||
        rule.event.type === 'image-added') {
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
        .forEach((rule) => callstack.push(rule));
    }
    return callstack;
  }, []);
  return _.uniqWith(callstack, _.isEqual); // remove dupes
};

module.exports = {
  buildCallstack,
};
