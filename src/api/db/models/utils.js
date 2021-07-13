const moment = require('moment');
const _ = require('lodash');
const Image = require('../schemas/Image');

const buildImgUrl = (image, config, size = 'original') => {
  const url = config.ANIML_IMAGES_URL;
  const id = image._id;
  const ext = image.fileTypeExtension;
  return url + size + '/' + id + '-' + size + '.' + ext;
};

const buildFilter = ({
  cameras,
  createdStart,
  createdEnd,
  addedStart,
  addedEnd,
  labels,
}) => {

  let camerasFilter = {};
  if (cameras) {
    camerasFilter = {'cameraSn': { $in: cameras }}
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

  // TODO: test
  // TODO: decide whether we want to include all labels? only non-invalidated
  // ones?
  let labelsFilter = {};
  if (labels) {
    labelsFilter = labels.includes('none')
      ? { $or: [
          {'objects.labels.category': { $in: labels }},
          { objects: { $size: 0 }}
        ]}
      : { 'objects.labels.category': { $in: labels } };
  };

  return {
    ...camerasFilter,
    ...dateCreatedFilter,
    ...dateAddedFilter,
    ...labelsFilter,
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
  const dto = moment(sanitized.dateTimeOriginal, config.TIME_FORMATS.EXIF);
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

const isLabelDupe = (image, newLabel) => {
  const labels = image.objects.reduce((labels, object) => {
    object.labels.forEach((label) => labels.push(label));
    return labels;
  }, []);

  for (const label of labels) {
    const modelMatch = newLabel.modelId && label.modelId && 
      newLabel.modelId.toString() === label.modelId.toString();
    const labelMatch = newLabel.category === label.category;
    const confMatch  = newLabel.conf === label.conf;
    const bboxMatch  = _.isEqual(newLabel.bbox, label.bbox);
    if (modelMatch && labelMatch && confMatch && bboxMatch) {
      console.log('this label has already been applied, skipping');
      return true;
    }
  }

  return false;
};

// Map image metadata to image schema
const createImageRecord = (md) => {
  const coords = parseCoordinates(md);
  const userSetData = getUserSetData(md);

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
    // optional fields...
    ...(md.model && { model: md.model }),
    ...(md.key && { originalFileName: md.key }),
    ...(md.imageWidth && { imageWidth: md.imageWidth }),
    ...(md.imageHeight && { imageHeight: md.imageHeight }),
    ...(md.MIMEType && { mimeType: md.MIMEType }),
    ...(userSetData && { userSetData: userSetData }),
    ...(location && { location: location }),
  });

  return image;
};

// TODO: accommodate users as label authors as well as models
const createLabelRecord = (input, authorId) => {
  console.log('createLabelRecord() - creating record with input: ', input);
  console.log('and authroId: ', authorId)
  const label = {
    ...(input._id && { _id: input._id }),
    type: input.type,
    category: input.category,
    conf: input.conf,
    bbox: input.bbox,
    labeledDate: moment(),
    ...((authorId && input.type === 'ml') && { modelId: authorId }),
    ...((authorId && input.type === 'manual') && { userId: authorId }),
    ...((authorId && input.type === 'manual') && { validation: input.validation }),
  };
  return label;
};

const hasRole = (userInfo, targetRoles = []) => {
  const cognitoGroups = userInfo && userInfo['cognito:groups'] || [];
  return cognitoGroups.some((role) => targetRoles.includes(role));
};

module.exports = {
  buildImgUrl,
  buildFilter,
  sanitizeMetadata,
  isLabelDupe,
  createImageRecord,
  createLabelRecord,
  hasRole,
};
