const agent = require('superagent');
const fs = require('fs');
const { buildImgUrl } = require('../api/db/models/utils');

// get image from S3, read in as buffer of binary data
const getImage = async (image, config) => {
  console.log('getImage() firing: ', );
  const url = buildImgUrl(image, config)
  let img;
  try {
    img = await agent.get(url).buffer(true);
    console.log('img: ', img);
    console.log('img.body: ', img.body);
  } catch (err) {
    console.log('error trying to get image from s3: ', err);
    throw err;
  }
  return Buffer.from(img.body, 'binary');
}

const runInference = {

  megadetector: async (params) => {
    const { model, image, label, config } = params;
    console.log(`requesting inference from ${model.name} on image: ${image.originalFileName}`);
    const imgBuffer = await getImage(image, config);
    let res;
    try {
      res = await agent
        .post(config['/ML/MEGADETECTOR_API_URL'])
        .query({ confidence: config['MEGADETECTOR_CONF_THRESHOLD'] })
        .query({ render: 'false' })
        .set('Ocp-Apim-Subscription-Key', config['/ML/MEGADETECTOR_API_KEY'])
        .attach(image._id, imgBuffer, image._id + '.jpg');
    } catch (err) {
      throw err;
    }
  
    // detections are in [ymin, xmin, ymax, xmax, confidence, category], 
    // where the first four floats are the relative coordinates of the bbox
    const tmpFile = res.files.detection_result.path;
    let detections = JSON.parse(fs.readFileSync(tmpFile));
    detections = detections[image._id].map((det) => ({
      modelId: model._id,
      type: 'ml',
      bbox: det.slice(0, 4),
      conf: det[4],
      category: config['MEGADETECTOR_CATEGORIES'].filter((cat) => (
        cat.id === det[5]
      ))[0].name,
    }));
    if (detections.length === 0) {
      detections.push({
        modelId: model._id,
        type: 'ml',
        bbox: [0, 0, 1, 1],
        category: 'empty',
      });
    }
    console.log('detections: ', detections);
    return detections;
  },

  mira: async (params) => {
    const { model, image, label, config } = params;
    console.log(`requesting inference from ${model.name} on image: ${image.originalFileName}`);
    const imgBuffer = await getImage(image, config);
    console.log(`label: `, label)
    const bbox = label.bbox ? label.bbox : [0,0,1,1];
    let res;
    try {
      res = await agent
        .post(config['/ML/MIRA_API_URL'])
        .field('bbox', JSON.stringify(bbox))
        .attach('image', imgBuffer, image._id + '.jpg');
    } catch (err) {
      throw err;
    }
    
    res = JSON.parse(res.res.text);
    console.log('res: ', res);
    return Object.values(res).reduce((detections, classifier) => {
      const [category, conf] = Object.entries(classifier.predictions)
        .sort((a, b) => b[1] - a[1])[0];
      console.log(`Top ${classifier['endpoint_name']} prediction: ${category} - ${conf}`);
      if (category !== 'empty') {
        detections.push({
          modelId: model._id,
          type: 'ml',
          bbox,
          conf,
          category
        });
      }
      return detections;
    }, []);
  },
}

module.exports = {
  runInference,
};
