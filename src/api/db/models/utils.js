const moment = require('moment');
const Image = require('../schemas/Image');
const config = require('../../../config/config');

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

  let labelsFilter = {};
  if (labels) {
    labelsFilter = labels.includes('none')
      ? { $or: [{'labels.category': { $in: labels }}, { labels: { $size: 0 }}]}
      : { 'labels.category': { $in: labels } };
  };

  return {
    ...camerasFilter,
    ...dateCreatedFilter,
    ...dateAddedFilter,
    ...labelsFilter,
  };
};

const sanitizeMetadata = (md) => {
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
    BuckEyeCam: (input) => {
      let userData = {};
      input.comment.split('\n').forEach((item) => {
        if (item.includes('TEXT1') || item.includes('TEXT2')) {
          userData[item.split('=')[0]] = item.split('=')[1];
        }
      });
      return userData;
    },
    RECONYX: (input) => ({
      userLabel: input.userLabel,
    }),
  };
  const usd = userDataMap[input.make](input);
  return usd ? usd : {};
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
    hash: md.hash,
    bucket: md.prodBucket,
    objectKey: md.prodKey,
    dateAdded: moment(),
    dateTimeOriginal: md.dateTimeOriginal,
    cameraSn: md.serialNumber,
    make: md.make,
    // optional fields
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

// TODO: accomodate users as label authors as well as models
const createLabelRecord = (input, modelId) => {
  const label = {
    type: input.type,
    category: input.category,
    conf: input.conf,
    bbox: input.bbox,
    labeledDate: moment(),
    validation: { reviewed: false, validated: false },
    ...(modelId && { model: modelId }),
  };
  return label;
};

module.exports = {
  buildFilter,
  sanitizeMetadata,
  createImageRecord,
  createLabelRecord,
};
