const moment = require('moment');
const ImageModel = require('../../db/models/Image');

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
const parseCoordinates = (input) => {
  function parse(stringCoord) {
    let deg, min, sec;
    [deg, min, sec] = stringCoord.match(/[+-]?(\d*\.)?\d+/g);
    const cardinal = stringCoord.match(/[N|S|E|W]$/g)[0];
    let degrees = Number(deg) + Number(min) / 60 + Number(sec) / 3600;
    return cardinal === 'S' || cardinal === 'W' ? degrees * -1 : degrees;
  }

  return input.GPSLongitude && input.GPSLatitude
    ? [parse(input.GPSLongitude), parse(input.GPSLatitude)]
    : null;
};

// Map image metadata to image schema
const mapMetaToModel = (md) => {
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

  const image = new ImageModel({
    hash: md.hash,
    bucket: md.prodBucket,
    objectKey: md.prodKey,
    dateAdded: moment(),
    dateTimeOriginal: md.dateTimeOriginal,
    camera: camera,
    // optional fields
    ...(md.key && { originalFileName: md.key }),
    ...(md.imageWidth && { imageWidth: md.imageWidth }),
    ...(md.imageHeight && { imageHeight: md.imageHeight }),
    ...(md.MIMEType && { mimeType: md.MIMEType }),
    ...(userSetData && { userSetData: userSetData }),
    ...(location && { location: location }),
  });

  return image;
};

module.exports = {
  mapMetaToModel,
};
