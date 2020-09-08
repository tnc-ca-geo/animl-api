const mongoose = require('mongoose');
const ImageModel = require('../../db/models/Image');
const moment = require('moment');

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

const createImage = async (_, { input }, context) => {
  console.log('Saving image with input: ', input);
  try {
    const db = await context.connectToDatabase();
    const userSetData = getUserSetData(input);
    const coords = parseCoordinates(input);

    const camera = {
      serialNumber: input.serialNumber,
      make: input.make,
      ...(input.model && { model: input.model }),
    };

    const location = coords && {
      geometry: { type: 'Point', coordinates: coords },
      ...(input.GPSAltitude && { altitude: input.GPSAltitude }),
    };

    const newImage = new ImageModel({
       ...input,
       camera,
       userSetData,
       location,
       dateAdded: moment(),
    });
    await newImage.save();
    console.log('Successfully saved image: ', newImage);

    // return value must match CreateImagePayload schema
    return { image: newImage };
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  createImage
};
