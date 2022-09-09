const { DateTime } = require('luxon');
const _ = require('lodash');
const { ApolloError } = require('apollo-server-errors');
const ObjectId = require('mongoose').Types.ObjectId;
const parser = require('mongodb-query-parser');
const Image = require('../schemas/Image');

// TODO: this file is getting unwieldy, break up

const idMatch = (idA, idB) => idA.toString() === idB.toString();

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
    camerasFilter = { cameraId: { $in: cameras } };
  }

  let deploymentsFilter = {};
  if (deployments) {
    const deploymentIds = deployments.map((depString) => (
      new ObjectId(depString))  // have to cast string id to ObjectId
    );
    deploymentsFilter = { deploymentId: { $in: deploymentIds } };
  }

  let dateCreatedFilter =  {};
  if (createdStart || createdEnd) {
    dateCreatedFilter = { dateTimeOriginal: {
      ...(createdStart && { $gte: createdStart.toJSDate() }),
      ...(createdEnd && { $lt: createdEnd.toJSDate() })
    } };
  }

  let dateAddedFilter = {};
  if (addedStart || addedEnd) {
    dateAddedFilter = { dateAdded: {
      ...(addedStart && { $gte: addedStart.toJSDate() }),
      ...(addedEnd && { $lt: addedEnd.toJSDate() })
    } };
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
          ] } }
        }
      } } }
    ] };
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
          category: { $in: labels }
        } }
      } } },

      // OR has an object that is not locked, but it has label that is
      // not-invalidated and included in filters
      { objects: { $elemMatch: {
        locked: false,
        labels: { $elemMatch: {
          'validation.validated': { $not: { $eq: false } },
          category: { $in: labels }
        } }
      } } }

    ] };

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
            ] } }
          }
        } } }
      ] };
      labelsFilter.$or.push(noObjectsFilter);
    }
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
      customFilter
    ]
  };
};

const sanitizeMetadata = (md, config) => {
  const sanitized = {};
  // If second char in key is uppercase,
  // assume it's an acronym (like GPSLatitude) & leave it,
  // else camel case
  for (const key in md) {
    // eslint-disable-next-line eqeqeq
    const newKey = !(key.charAt(1) == key.charAt(1).toUpperCase())
      ? key.charAt(0).toLowerCase() + key.slice(1)
      : key;
    sanitized[newKey] = md[key];
  }
  // TODO TIME: a valid question is whether we need to store the dateTimeOriginal
  // at all anymore, or whether we should (a) keep it as is,
  // or (b) set it's zone before storing it
  // UPDATED THOUGHTS: we definitely need the dateTimeOriginal if we want to
  // preserve the ability to re-set the timezone (i.e., if you change the TZ
  // of the deployment it's associated with). We also want to store the TZ on
  // the image record. So the questions now are - (1) do we modify dateTimeOriginal and
  // bake in its current TZ offset, and forgo saving timezone as a separate field?
  // and (2) if we just bake the offset into the dateTimeOriginal,
  // do we need to convert to UTC anymore? won't Luxon handle comparing datetimes
  // in different TZs for us?
  // MORE THOUGHTS: so I think we do need to modify dateTimeOriginal (set TZ)
  // because it implicitly gets set as UTC+0 regardless if we don't. Question
  // is now do we need separate TZ name field or separate dateTimeUTC field
  // I think yes to TZ name field,  no need to keep dateTimeUTC.
  const exifFormat = config['TIME_FORMATS']['EXIF'];
  const dto = DateTime.fromFormat(sanitized.dateTimeOriginal, exifFormat);
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
    'RECONYX': (input) => {
      if (!input.userLabel) {
        return null;
      }
      return {
        userLabel: input.userLabel
      };
    }
  };

  const usd = (input.make && userDataMap[input.make])
    ? userDataMap[input.make](input)
    : null;

  return usd;
};

// Parse string coordinates to decimal degrees
// input e.g. - `34 deg 6' 25.59" N`
const parseCoordinates = (md) => {
  function parse(stringCoord) {
    let deg, min, sec;
    // eslint-disable-next-line prefer-const
    [deg, min, sec] = stringCoord.match(/[+-]?(\d*\.)?\d+/g);
    const cardinal = stringCoord.match(/[N|S|E|W]$/g)[0];
    const degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
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
  console.log('creating image record with metadata: ', md);
  const coords = parseCoordinates(md);
  const userSetData = getUserSetData(md);

  const location = coords && {
    geometry: { type: 'Point', coordinates: coords },
    ...(md.GPSAltitude && { altitude: md.GPSAltitude })
  };

  const image = new Image({
    _id: md.hash,
    bucket: md.prodBucket,
    fileTypeExtension: md.fileTypeExtension,
    dateAdded: DateTime.now(),
    dateTimeOriginal: md.dateTimeOriginal,
    // dateTimeUTC: md.dateTimeUTC,
    timezone: md.timezone,
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
    ...(location && { location: location })
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
    labeledDate: DateTime.now(),
    ...((authorId && type === 'ml') && { mlModel: authorId }),
    ...((authorId && type === 'ml') && { mlModelVersion }),
    ...((authorId && type === 'manual') && { userId: authorId }),
    ...((authorId && type === 'manual') && { validation })
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
const findDeployment = (img, camConfig, config, projTimeZone) => {
  console.log('finding deployment for img: ', img);
  // find the deployment that's start date is closest to (but preceeds)
  // the image's created date

  // NOTE: we do not know the timezone for the image yet b/c we pull the
  // timezone from the deployment record, which we are in the proess of finding.
  // So Luxon will assume imgCreated to be in UTC+0 by default (but it likely isn't)
  // and we'll be comparing that to the deployment's start date,
  // which is stored in UTC+0...

  // current (imperfect) solution is be to use the project's default timezone
  // and assume the image is in that timezone. That would mean there's still
  // a chance the correct deployment we want to associate the image with
  // is in a different timezone than the project default and it could get
  // paired to the wrong deployment.

  const exifFormat = config['TIME_FORMATS']['EXIF'];
  let imgCreated = !DateTime.isDateTime(img.dateTimeOriginal)
    ? DateTime.fromFormat(img.dateTimeOriginal, exifFormat)
    : img.dateTimeOriginal;
  imgCreated = imgCreated.setZone(projTimeZone, { keepLocalTime: true });
  const defaultDep = camConfig.deployments.find((dep) => dep.name === 'default');

  let mostRecentDep = null;
  let shortestInterval = null;
  for (const dep of camConfig.deployments) {
    if (dep.name !== 'default') {
      const depStart = DateTime.fromJSDate(dep.startDate);
      const timeDiff = imgCreated.diff(depStart).toObject().milliseconds;
      // if time elapsed is negative,
      // image was taken before the deployment start date
      if (
        (shortestInterval === null || shortestInterval > timeDiff) &&
                timeDiff >= 0
      ) {
        mostRecentDep = dep;
        shortestInterval = timeDiff;
      }
    }
  }

  return mostRecentDep || defaultDep;
};

const mapImgToDep = (img, camConfig, config, projTimeZone) => {
  if (camConfig.deployments.length === 0) {
    throw new ApolloError('Camera config has no deployments');
  }

  return (camConfig.deployments.length === 1)
    ? camConfig.deployments[0]
    : findDeployment(img, camConfig, config, projTimeZone);
};

const sortDeps = (deps) => {
  console.log('sorting deployments');
  // remove default deployment (temporarily)
  const defaultDep = deps.find((dep) => dep.name === 'default');
  let chronDeps = _.cloneDeep(deps);
  chronDeps = chronDeps.filter((dep) => dep.startDate);

  // sort chonologically
  chronDeps.sort((a, b) => {
    const aStart = DateTime.fromJSDate(a.startDate);
    const bStart = DateTime.fromJSDate(b.startDate);
    return aStart.diff(bStart);
  });

  // add default deployment back in
  chronDeps.unshift(defaultDep);
  return chronDeps;
};

const findActiveProjReg = (camera) => {
  const activeProjReg = camera.projRegistrations.find((pr) => pr.active);
  if (!activeProjReg) {
    const err = 'Can\'t find active project registration on camera';
    throw new ApolloError(err);
  }

  return activeProjReg.projectId;
};

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
  mapImgToDep,
  sortDeps,
  findActiveProjReg,
  idMatch,
  isImageReviewed
};
