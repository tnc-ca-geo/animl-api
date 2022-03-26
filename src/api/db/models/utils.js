const moment = require('moment');
const _ = require('lodash');
const ObjectId = require('mongoose').Types.ObjectId;
const parser = require('mongodb-query-parser');
const Image = require('../schemas/Image');
const retry = require('async-retry');

// TODO: this file is getting unwieldy, break up 

// TODO: fix issues with retryWrapper - if image successfully saves
// and then an error gets thrown in automation.eventHandler, 
// retryWrapper retries this whole function again (including save image)
// but it gets rejected b/c the image is now a duplicate
const retryWrapper = (fn, input, context) => {
  return retry(async (bail, attempt) => {
    if (attempt > 1) console.log(`Retrying operation! Attempt #: ${attempt}`);
    return await fn(input, context);
  }, { retries: 2 });
};

const saveDocRetryWrapper = (doc) => {
  return retry(async (bail, attempt) => {
    if (attempt > 1) console.log(`Retrying operation! Attempt #: ${attempt}`);
    return await doc.save();
  }, { retries: 2 });
};

const buildImgUrl = (image, config, size = 'original') => {
  const url = config['/IMAGES/URL'];
  const id = image._id;
  const ext = image.fileTypeExtension;
  return url + '/' + size + '/' + id + '-' + size + '.' + ext;
};

const buildFilter = ({
  cameras,
  deployments,
  createdStart,
  createdEnd,
  addedStart,
  addedEnd,
  labels,
  reviewed,
  custom,
}, user) => {

  let projectFilter = {'project': user['curr_project']};

  let camerasFilter = {};
  if (cameras) {
    camerasFilter = {'cameraSn': { $in: cameras }}
  }

  let deploymentsFilter = {};
  if (deployments) {
    const deploymentIds = deployments.map((depString) => (
      new ObjectId(depString))  // have to cast string id to ObjectId
    );
    deploymentsFilter = {'deployment': { $in: deploymentIds }}
  }

  let dateCreatedFilter =  {};
  if (createdStart || createdEnd) {
    dateCreatedFilter = {'dateTimeOriginal': {
      ...(createdStart && { $gte: createdStart.toDate() }),
      ...(createdEnd && { $lt: createdEnd.toDate() }),
    }};
  }

  let dateAddedFilter = {};
  if (addedStart || addedEnd) {
    dateAddedFilter = {'dateAdded': {
      ...(addedStart && { $gte: addedStart.toDate() }),
      ...(addedEnd && { $lt: addedEnd.toDate() }),
    }};
  }

  let reviewedFilter = {};
  if (reviewed === false) {
    // exclude reviewed images (images that have all locked objects)
    // equivalant to: incldue images that have at least one unlocked object
    reviewedFilter = {'objects.locked': false};
  }

  let labelsFilter = {};
  if (labels) {
    labelsFilter = {$or: [
      // has an object that is locked,
      // and it has a label that is both validated and included in filters
      // NOTE: this is still not perfect: I'm not sure how to determine 
      // whether the FIRST validated label is included in the filters. Right 
      // now if there is ANY label that is both validated and is in filters, 
      // the image will pass the filter
      {objects: {$elemMatch: {
          locked: true,
          labels: {$elemMatch: {
            'validation.validated': true,
            category: {$in: labels},
          }}
      }}},
      // has an object is not locked, but it has label that is 
      // not-invalidated and included in filters
      {'objects': {$elemMatch: {
        locked: false,
        labels: {$elemMatch: {
            'validation.validated': {$not: {$eq: false}},
            category: {$in: labels},
          }}
      }}},
    ]};
  }

  let customFilter = {};
  if (custom) {
    customFilter = parser.isFilterValid(custom);
  }
  
  return {
    ...projectFilter,
    ...camerasFilter,
    ...deploymentsFilter,
    ...dateCreatedFilter,
    ...dateAddedFilter,
    ...reviewedFilter,
    ...labelsFilter,
    ...customFilter,
  };
};

const sanitizeMetadata = (md, config) => {
  let sanitized = {};
  // If second char in key is uppercase,
  // assume it's an acronym (like GPSLatitude) & leave it,
  // else camel case
  for (let key in md) {
    const newKey = !(key.charAt(1) == key.charAt(1).toUpperCase())
      ? key.charAt(0).toLowerCase() + key.slice(1)
      : key;
    sanitized[newKey] = md[key];
  }
  const dto = moment(sanitized.dateTimeOriginal, config['TIME_FORMATS']['EXIF']);
  sanitized.dateTimeOriginal = dto;
  return sanitized;
};

// Unpack user-set exif tags
const getUserSetData = (input) => {
  const userDataMap = {
    'BuckEyeCam': (input) => {
      if (!input.comment) {
        return null;
      }
      let userData = {};
      input.comment.split('\n').forEach((item) => {
        if (item.includes('TEXT1') || item.includes('TEXT2')) {
          userData[item.split('=')[0]] = item.split('=')[1];
        }
      });
      return userData;
    },
    'RECONYX': (input) => {
      if (!input.userLabel) {
        return null;
      }
      return {
        userLabel: input.userLabel,
      }
    },
  };

  const usd = (input.make && userDataMap[input.make])
    ? userDataMap[input.make](input)
    : null;
};

// Parse string coordinates to decimal degrees
// input e.g. - `34 deg 6' 25.59" N`
const parseCoordinates = (md) => {
  function parse(stringCoord) {
    let deg, min, sec;
    [deg, min, sec] = stringCoord.match(/[+-]?(\d*\.)?\d+/g);
    const cardinal = stringCoord.match(/[N|S|E|W]$/g)[0];
    let degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
    return cardinal === 'S' || cardinal === 'W' ? degrees * -1 : degrees;
  }

  if (!md.GPSLongitude || !md.GPSLatitude) {
    return null;
  }
  else if (typeof md.GPSLongitude === 'string') {
    return [parse(md.GPSLongitude), parse(md.GPSLatitude)];
  }
  else {
    return [md.GPSLongitude, md.GPSLatitude];
  }

};

// Map image metadata to image schema
const createImageRecord = (md) => {
  const coords = parseCoordinates(md);
  const userSetData = getUserSetData(md);

  // TODO: are we even using this? do we need it?
  const camera = {
    serialNumber: md.serialNumber,
    make: md.make,
    ...(md.model && { model: md.model }),
  };

  const location = coords && {
    geometry: { type: 'Point', coordinates: coords },
    ...(md.GPSAltitude && { altitude: md.GPSAltitude }),
  };

  const image = new Image({
    _id: md.hash,
    bucket: md.prodBucket,
    fileTypeExtension: md.fileTypeExtension,
    dateAdded: moment(),
    dateTimeOriginal: md.dateTimeOriginal,
    cameraSn: md.serialNumber,
    make: md.make,
    deployment: md.deployment,
    project: md.project,
    ...(md.model && { model: md.model }),
    ...(md.fileName && { originalFileName: md.fileName }),
    ...(md.imageWidth && { imageWidth: md.imageWidth }),
    ...(md.imageHeight && { imageHeight: md.imageHeight }),
    ...(md.MIMEType && { mimeType: md.MIMEType }),
    ...(userSetData && { userSetData: userSetData }),
    ...(location && { location: location }),
  });

  return image;
};

// TODO: this us ugly clean up!
const isLabelDupe = (image, newLabel) => {
  const labels = image.objects.reduce((labels, object) => {
    object.labels.forEach((label) => labels.push(label));
    return labels;
  }, []);

  for (const label of labels) {

    const mlModelMatch = newLabel.mlModel && label.mlModel && 
      newLabel.mlModel.toString() === label.mlModel.toString();
    const mlModelVersionMatch = newLabel.mlModelVersion && 
                                label.mlModelVersion && 
                                newLabel.mlModel.toString() === label.mlModel.toString();
    const labelMatch = newLabel.category === label.category;
    const confMatch  = newLabel.conf === label.conf;
    const bboxMatch  = _.isEqual(newLabel.bbox, label.bbox);

    if (mlModelMatch && mlModelVersionMatch && labelMatch && confMatch && bboxMatch) {
      // label has already been applied, skipping
      return true;
    }
  }

  return false;
};

// TODO: accommodate users as label authors as well as models
const createLabelRecord = (input, authorId) => {
  const { _id, type, category, conf, bbox, mlModelVersion, validation } = input;
  const label = {
    ...(_id && { _id }),
    type,
    category,
    conf,
    bbox,
    labeledDate: moment(),
    ...((authorId && type === 'ml') && { mlModel: authorId }),  // NEW
    ...((authorId && type === 'ml') && { mlModelVersion }), // NEW
    ...((authorId && type === 'manual') && { userId: authorId }),
    ...((authorId && type === 'manual') && { validation }),
  };
  return label;
};

const hasRole = (userInfo, targetRoles = []) => {
  const cognitoGroups = userInfo && userInfo['cognito:groups'] || [];
  return cognitoGroups.some((role) => targetRoles.includes(role));
};

// TODO: accomodate user-created deployments with no startDate?
// NEW
const findDeployment = (image, cameraConfig) => {
  // find most recent deployment start date
  const imgCreated = !moment.isMoment(image.dateTimeOriginal) 
    ? moment(image.dateTimeOriginal)
    : image.dateTimeOriginal;
  const defaultDep = cameraConfig.deployments.find((dep) => dep.name === 'default');
  
  let mostRecentDep = { deploymentId: null, timeElapsed: null };
  for (const dep of cameraConfig.deployments) {
    if (dep.name !== 'default') {
      const timeElapsed = imgCreated.diff(moment(dep.startDate));
      // if time elapsed is negative, image was taken before the dep began
      if (timeElapsed >= 0 &&
          (mostRecentDep.timeElapsed === null || 
           mostRecentDep.timeElapsed > timeElapsed)) {
        mostRecentDep = { deploymentId: dep._id, timeElapsed };
      }
    }
  }

  return mostRecentDep.deploymentId !== null
    ? mostRecentDep.deploymentId
    : defaultDep._id;
};

// NEW - updated this to find deployments in camera config entries, i.e.:
// Project.cameras.deployments
const mapImageToDeployment = (image, cameraConfig) => {
  console.log(`utils.mapImageToDeployment() - image: ${JSON.stringify(image)}`);
  console.log(`utils.mapImageToDeployment() - cameraConfig: ${cameraConfig}`);

  if (cameraConfig.deployments.length === 0) {
    throw new ApolloError('Camera has no deployments');
  }

  return (cameraConfig.deployments.length === 1) 
    ? cameraConfig.deployments[0]._id 
    : findDeployment(image, cameraConfig);
};

// NEW
const sortDeps = (deps) => {
  console.log('utils.sortDeps() - deps before sort: ', deps);

  // remove default deployment (temporarily)
  let defaultDep = deps.find((dep) => dep.name === 'default');
  let chronDeps = _.cloneDeep(deps);
  chronDeps = chronDeps.filter((dep) => dep.startDate); 

  // sort chonologically
  chronDeps.sort((a, b) => {
    const aStart = moment(a.startDate);
    const bStart = moment(b.startDate);
    return aStart.diff(bStart);
  });

  // add default deployment back in
  chronDeps.unshift(defaultDep);
  return chronDeps;
};

const findActiveProjReg = (camera) => {
  const activeProjReg = camera.projRegistrations.find((pr) => (
    pr.active
  ));

  if (!activeProjReg) {
    const err = `Can't find active project registration for image: ${md}`;
    throw new ApolloError(err);
  }

  console.log(`utils.findActiveProjReg() - Found active project registration - ${activeProjReg.project}`);
  return activeProjReg.project;
};


module.exports = {
  retryWrapper,
  saveDocRetryWrapper,
  buildImgUrl,
  buildFilter,
  sanitizeMetadata,
  isLabelDupe,
  createImageRecord,
  createLabelRecord,
  hasRole,
  mapImageToDeployment,
  sortDeps,
  findActiveProjReg,
};
