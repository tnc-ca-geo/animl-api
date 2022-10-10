const moment = require('moment');
const _ = require('lodash');
const ObjectId = require('mongoose').Types.ObjectId;
const parser = require('mongodb-query-parser');
const Image = require('../schemas/Image');
const { ApolloError } = require('apollo-server-errors');


// TODO: this file is getting unwieldy, break up

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
  custom
}, projectId) => {

  let projectFilter = {};
  if (projectId) {
    projectFilter = { projectId };
  }

  let camerasFilter = {};
  if (cameras) {
    camerasFilter = { cameraId: { $in: cameras }}
  }

  let deploymentsFilter = {};
  if (deployments) {
    const deploymentIds = deployments.map((depString) => (
      new ObjectId(depString))  // have to cast string id to ObjectId
    );
    deploymentsFilter = { deploymentId: { $in: deploymentIds }}
  }

  let dateCreatedFilter =  {};
  if (createdStart || createdEnd) {
    dateCreatedFilter = { dateTimeOriginal: {
      ...(createdStart && { $gte: createdStart.toDate() }),
      ...(createdEnd && { $lt: createdEnd.toDate() }),
    }};
  }

  let dateAddedFilter = {};
  if (addedStart || addedEnd) {
    dateAddedFilter = { dateAdded: {
      ...(addedStart && { $gte: addedStart.toDate() }),
      ...(addedEnd && { $lt: addedEnd.toDate() }),
    }};
  }

  let reviewedFilter = {};
  if (reviewed === false) { 

    // incldue images that need review, i.e.:
    // have at least one unlocked object,
    // no objects at all,
    // OR all invalidated labels
    reviewedFilter = { $or: [
      { 'objects.locked': false },
      { objects: { $size: 0 } },
      { objects: { $not: {
        $elemMatch: {
          labels: { $elemMatch: { $or: [
            { validation: null },
            { 'validation.validated': true }
          ]}}
        }
      }}}
    ]}
  }

  let labelsFilter = {};
  if (labels) {
    labelsFilter = { $or: [

      // has an object that is locked,
      // and it has a label that is both validated and included in filters
      // NOTE: this is still not perfect: I'm not sure how to determine 
      // whether the FIRST validated label is included in the filters. Right 
      // now if there is ANY label that is both validated and is in filters, 
      // the image will pass the filter
      { objects: { $elemMatch: {
          locked: true,
          labels: { $elemMatch: {
            'validation.validated': true,
            category: { $in: labels },
          }}
      }}},

      // OR has an object that is not locked, but it has label that is 
      // not-invalidated and included in filters
      { objects: { $elemMatch: {
        locked: false,
        labels: { $elemMatch: {
            'validation.validated': { $not: { $eq: false }},
            category: { $in: labels },
          }}
      }}},

    ]};

    // if labels includes "none", also return images with no objects
    if (labels.includes('none')) {
      const noObjectsFilter = { $or: [
        // return images w/ no objects,
        { objects: { $size: 0 } },
        // or images in which all labels of all objects have been invalidated
        { objects: { $not: {
          $elemMatch: {
            labels: { $elemMatch: { $or: [
              { validation: null },
              { 'validation.validated': true }
            ]}}
          }
        }}}
      ]};
      labelsFilter.$or.push(noObjectsFilter);
    };
  }


  let customFilter = {};
  if (custom) {
    customFilter = parser.isFilterValid(custom);
  }

  return {
    $and: [
      projectFilter,
      camerasFilter,
      deploymentsFilter,
      dateCreatedFilter,
      dateAddedFilter,
      reviewedFilter,
      labelsFilter,
      customFilter,
    ]
  }
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
      const userData = {};
      input.comment.split('\n').forEach((item) => {
        if (item.includes('TEXT1') || item.includes('TEXT2')) {
          userData[item.split('=')[0]] = item.split('=')[1];
        }
      });
      return userData;
    },
    'RidgeTec': (input) => {
      if (!input.userComment) {
        return null;
      }
      const userData = {};
      input.userComment.split('\n').forEach((item) => {
        if (item.includes('AccountId')) {
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

  return (input.make && userDataMap[input.make])
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
    cameraId: md.serialNumber,
    make: md.make,
    deploymentId: md.deploymentId,
    projectId: md.projectId,
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

const isLabelDupe = (image, newLabel) => {

  const labels = image.objects.reduce((labels, object) => {
    object.labels.forEach((label) => labels.push(label));
    return labels;
  }, []);

  for (const label of labels) {

    const mlModelMatch = newLabel.mlModel && label.mlModel && 
      idMatch(newLabel.mlModel, label.mlModel);
  
    const mlModelVerMatch = newLabel.mlModelVersion && label.mlModelVersion && 
      newLabel.mlModelVersion.toString() === label.mlModelVersion.toString();

    const labelMatch = newLabel.category === label.category;
    const confMatch  = newLabel.conf === label.conf;
    const bboxMatch  = _.isEqual(newLabel.bbox, label.bbox);

    if (
      mlModelMatch && 
      mlModelVerMatch && 
      labelMatch && 
      confMatch && 
      bboxMatch
    ) {
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
    ...((authorId && type === 'ml') && { mlModel: authorId }),
    ...((authorId && type === 'ml') && { mlModelVersion }),
    ...((authorId && type === 'manual') && { userId: authorId }),
    ...((authorId && type === 'manual') && { validation }),
  };
  return label;
};

// TODO: consider calling this isAuthorized() ?
const hasRole = (user, targetRoles = []) => {
  const hasAuthorizedRole = user['curr_project_roles'] &&
    user['curr_project_roles'].some((role) => (targetRoles.includes(role)));
  return user['is_superuser'] || hasAuthorizedRole;
};

// TODO: accomodate user-created deployments with no startDate?
const findDeployment = (img, camConfig) => {
  // find most recent deployment start date
  const imgCreated = !moment.isMoment(img.dateTimeOriginal) 
    ? moment(img.dateTimeOriginal)
    : img.dateTimeOriginal;
  const defaultDep = camConfig.deployments.find((dep) => dep.name === 'default');
  
  let mostRecentDep = { deploymentId: null, timeElapsed: null };
  for (const dep of camConfig.deployments) {
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

const mapImageToDeployment = (img, camConfig) => {
  if (camConfig.deployments.length === 0) {
    throw new ApolloError('Camera config has no deployments');
  }

  return (camConfig.deployments.length === 1) 
    ? camConfig.deployments[0]._id 
    : findDeployment(img, camConfig);
};

const sortDeps = (deps) => {

  // remove default deployment (temporarily)
  const defaultDep = deps.find((dep) => dep.name === 'default');
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
  const activeProjReg = camera.projRegistrations.find((pr) => pr.active);
  if (!activeProjReg) {
    const err = `Can't find active project registration for image: ${md}`;
    throw new ApolloError(err);
  }

  return activeProjReg.projectId;
};

const idMatch = (idA, idB) => idA.toString() === idB.toString();

const isImageReviewed = (image) => {
  // images are considered reviewed if they: 
  // have objects,
  // all objects are locked,
  // AND there are no locked objects with all invalidated labels
  const hasObjs = image.objects.length > 0;
  const hasUnlockedObjs = image.objects.some((obj) => obj.locked === false);
  const hasAllInvalidatedLabels = !image.objects.some((obj) => (
    obj.labels.some((lbl) => !lbl.validation || lbl.validation.validated)
  ));
  return hasObjs && !hasUnlockedObjs && !hasAllInvalidatedLabels;
};

module.exports = {
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
  idMatch,
  isImageReviewed
};
