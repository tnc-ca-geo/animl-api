const agent = require('superagent');
const fs = require('fs');
const url = require('url');
const config = require('../config/config');

const getBBox = (image, models) => {
  if (!image.labels) {
    return null;
  }
  // TODO: figure out how to account for multiple versions of megadetector
  const megadetector = models.filter((m) => m.name === 'megadetector')[0]; // ugly
  const megadetectorLabels = image.labels
    .filter((label) => label.model === megadetector._id)
    .sort((a, b) => b.conf - a.conf);
  return megadetectorLabels[0].bbox;
};

const runInference = {
  megadetector: async (image, models) => {

    console.log('calling megadetector on image: ', image.originalFileName);

    const megadetector = models.filter((m) => m.name === 'megadetector')[0]; // ugly

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
      modelId: megadetector._id,
      type: 'ml',
      bbox: det.slice(0, 4),
      conf: det[4],
      category: config.MEGADETECTOR_CATEGORIES.filter((cat) => (
         cat.id === det[5]
      ))[0].name,
    }));
    console.log('detections: ', detections);
    return detections;
  },
  mira: async (image, models) => {

    const mira = models.filter((m) => m.name === 'mira')[0];  // TODO: ugly

    console.log('calling mira on image: ', image.originalFileName);

    const imageUrl = config.ANIML_IMAGES_URL + 'images/' + image.hash + '.jpg';
    const img = await agent.get(imageUrl);
    const imgBuffer = Buffer.from(img.body, 'binary');

    let bbox = getBBox(image, models);
    bbox = bbox ? bbox : [0,0,1,1];

    let res;
    try {
      res = await agent
        .post(config.MIRA_URL)
        .field('bbox', JSON.stringify(bbox))
        .attach('image', imgBuffer, image.hash + '.jpg');
    } catch (err) {
      throw new Error(err);
    }

    res = JSON.parse(res.res.text);
    console.log('res: ', res);
    let detections = [];
    Object.values(res).forEach((model) => {
      const [category, conf] = Object.entries(model.predictions)
        .sort((a, b) => b[1] - a[1])[0];
      console.log(`Top ${model['endpoint_name']} prediction: ${category} - ${conf}`);
      detections.push({
        modelId: mira._id,
        type: 'ml',
        bbox,
        conf,
        category
      })
    });
    return detections;
  },
}

module.exports = {
  runInference,
};
