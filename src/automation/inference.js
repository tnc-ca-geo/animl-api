const agent = require('superagent');
const fs = require('fs');
const url = require('url');
const config = require('../config/config');

const call = {
  megadetector: async (image) => {
    // get image from S3, read in as buffer of binary data
    const imageUrl = config.ANIML_IMAGES_URL + 'images/' + image.hash + '.jpg';
    const img = await agent.get(imageUrl);
    const imgBuffer = Buffer.from(img.body, 'binary');
    let res;
    try {
      res = await agent
        .post(config.MEGADETECTOR_URL)
        .query({ confidence: config.MEGADETECTOR_CONF_THRESHOLD })
        .query({ render: 'false' })
        .set('Ocp-Apim-Subscription-Key', config.MEGADETECTOR_API_KEY)
        .attach(image.hash, imgBuffer, image.hash + '.jpg');
    } catch (err) {
      throw new Error(err);
    }
  
    // detections are in [ymin, xmin, ymax, xmax, confidence, category], 
    // where the first four floats are the relative coordinates of the bbox
    const tmpFile = res.files.detection_result.path;
    let detections = JSON.parse(fs.readFileSync(tmpFile));
    detections = detections[image.hash].map((det) => ({
      bbox: det.slice(0, 4),
      conf: det[4],
      category: config.MEGADETECTOR_CATEGORIES.filter((cat) => (
         cat.id === det[5]
      ))[0].name,
    }));
    return detections;
  },
  mira: async (image, bbox) => {
    // TODO: call mira
  },
}

module.exports = {
  call,
};
