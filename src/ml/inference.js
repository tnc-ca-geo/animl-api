const agent = require('superagent');
const fs = require('fs');

// get image from S3, read in as buffer of binary data
const getImage = async (image, config) => {
  const imageUrl = config.ANIML_IMAGES_URL + 'images/' + image._id + '.jpg';
  console.log('image url: ', imageUrl);
  const img = await agent.get(imageUrl);
  console.log('img: ', img);
  return Buffer.from(img.body, 'binary');
}

const runInference = {

  megadetector: async (params) => {
    const { model, image, label, config } = params;
    console.log(`calling ${model.name} on image: ${image.originalFileName}`);
    const imgBuffer = await getImage(image, config);
    console.log('imgBuffer: ', imgBuffer);
    let res;
    try {
      res = await agent
        .post(config.MEGADETECTOR_API_URL)
        .query({ confidence: config.MEGADETECTOR_CONF_THRESHOLD })
        .query({ render: 'false' })
        .set('Ocp-Apim-Subscription-Key', config.MEGADETECTOR_API_KEY)
        .attach(image._id, imgBuffer, image._id + '.jpg');
      console.log('res: ', res);
    } catch (err) {
      throw new Error(err);
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
      category: config.MEGADETECTOR_CATEGORIES.filter((cat) => (
        cat.id === det[5]
      ))[0].name,
    }));
    console.log('detections: ', detections);
    return detections;
  },

  mira: async (params) => {
    const { model, image, label, config } = params;
    console.log(`calling ${model.name} on image: ${image.originalFileName}`);
    const imgBuffer = await getImage(image, config);
    console.log(`label: `, label)
    const bbox = label.bbox ? label.bbox : [0,0,1,1];
    let res;
    try {
      res = await agent
        .post(config.MIRA_API_URL)
        .field('bbox', JSON.stringify(bbox))
        .attach('image', imgBuffer, image._id + '.jpg');
    } catch (err) {
      throw new Error(err);
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
