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
  } catch (err) {
    console.log('error trying to get image from s3: ', err);
    throw err;
  }
  return Buffer.from(img.body, 'binary');
}

const runInference = {

  // NEW - return mlModelVersion with all detections

  megadetector: async (params) => {
    const { modelSource, catConfig, image, label, config } = params;
    console.log(`requesting inference from ${modelSource._id} on image: ${image.originalFileName}`);
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
    const detections = JSON.parse(fs.readFileSync(tmpFile));
    console.log('detections before filtering: ', detections);
    let filteredDetections = detections[image._id].map((det) => ({
      mlModel: modelSource._id,
      mlModelVersion: modelSource.version,
      type: 'ml',
      bbox: det.slice(0, 4),
      conf: det[4],
      category: catConfig.find((cat) => cat._id === det[5]).name,
    }));

    // NEW - filter out disabled detections & detections below confThreshold
    filteredDetections = filteredDetections.filter((det) => {
      const { disabled, confThreshold } = catConfig.find((cat) => (
        cat.name === det.category
      ));
      return !disabled && det.conf >= confThreshold;
    });

    if (filteredDetections.length === 0) {
      filteredDetections.push({
        mlModel: modelSource._id,
        mlModelVersion: modelSource.version,
        type: 'ml',
        bbox: [0, 0, 1, 1],
        category: 'empty',
      });
    }

    console.log('filteredDetections: ', filteredDetections);
    return filteredDetections;
  },

  mira: async (params) => {
    const { modelSource, catConfig, image, label, config } = params;
    console.log(`requesting inference from ${modelSource.name} on image: ${image.originalFileName}`);
    const imgBuffer = await getImage(image, config);
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
    console.log('detections before filtering: ', res);

    return Object.values(res).reduce((detections, classifier) => {
      // only evaluate top predictions from MIRA
      const [category, conf] = Object.entries(classifier.predictions)
        .sort((a, b) => b[1] - a[1])[0];
      console.log(`Top ${classifier['endpoint_name']} prediction: ${category} - ${conf}`);

      const { disabled, confThreshold } = catConfig.find((cat) => (
        cat.name === category
      ));

      // NEW - filter out disabled detections & detections below confThreshold
      if (!disabled && (category !== 'empty') && (conf >= confThreshold)) {
        detections.push({
          mlModel: modelSource._id,
          mlModelVersion: modelSource.version,
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
