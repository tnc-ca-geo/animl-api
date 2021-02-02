const agent = require('superagent');
const fs = require('fs');
const url = require('url');
const config = require('../config/config');
const generateImageModel = require('../api/db/models/Image');

// get image from S3, read in as buffer of binary data
const getImage = async (image) => {
  const imageUrl = config.ANIML_IMAGES_URL + 'images/' + image.hash + '.jpg';
  const img = await agent.get(imageUrl);
  return Buffer.from(img.body, 'binary');
}

const runInference = {

  megadetector: async (model, image, label) => {
    console.log(`calling ${model.name} on image: ${image.originalFileName}`);
    const imgBuffer = await getImage(image);
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
      modelId: model._id,
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

  mira: async (model, image, label) => {
    console.log(`calling ${model.name} on image: ${image.originalFileName}`);
    const imgBuffer = await getImage(image);
    console.log(`label: `, label)
    const bbox = label.bbox ? label.bbox : [0,0,1,1];
    let res;
    try {
      res = await agent
        .post(config.MIRA_URL)
        .field('bbox', JSON.stringify(bbox))
        .attach('image', imgBuffer, image.hash + '.jpg');
    } catch (err) {
      throw new Error(err);
    }
    
    // TODO: add label reconciling function

    res = JSON.parse(res.res.text);
    console.log('res: ', res);
    let detections = [];
    Object.values(res).forEach((model) => {
      const [category, conf] = Object.entries(model.predictions)
        .sort((a, b) => b[1] - a[1])[0];
      console.log(`Top ${model['endpoint_name']} prediction: ${category} - ${conf}`);
      detections.push({
        modelId: model._id,
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
