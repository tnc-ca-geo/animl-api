const agent = require('superagent');
const { buildImgUrl } = require('../api/db/models/utils');
const {
  SageMakerRuntimeClient,
  InvokeEndpointCommand
} = require('@aws-sdk/client-sagemaker-runtime');

const _getImage = async (image, config) => {
  const url = buildImgUrl(image, config);

  try {
    const img = await agent.get(url);
    return Buffer.from(img.body, 'binary');
  } catch (err) {
    throw new Error(err);
  }
};

const megadetector = async (params) => {
  const { modelSource, catConfig, image, config } = params;
  const imgBuffer = await _getImage(image, config);

  try {
    const smr = new SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new InvokeEndpointCommand({
      Body: imgBuffer,
      EndpointName: config['/ML/MEGADETECTOR_SAGEMAKER_NAME']
    });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const detections = JSON.parse(body);
    console.log('detections returned from megadetector endpoint: ', detections);

    const formatedDets = detections.map((det) => ({
      mlModel: modelSource._id,
      mlModelVersion: modelSource.version,
      type: 'ml',
      bbox: [det.y1, det.x1, det.y2, det.x2],
      conf: det.confidence,
      category: catConfig.find((cat) => (
        parseInt(cat._id) === parseInt(det.class)
      )).name
    }));

    // filter out disabled detections & detections below confThreshold
    const filteredDets = formatedDets.filter((det) => {
      const { disabled, confThreshold } = catConfig.find((cat) => (
        cat.name === det.category
      ));
      return !disabled && det.conf >= confThreshold;
    });

    // add "empty" detection
    if (filteredDets.length === 0) {
      filteredDets.push({
        mlModel: modelSource._id,
        mlModelVersion: modelSource.version,
        type: 'ml',
        bbox: [0, 0, 1, 1],
        category: 'empty'
      });
    }

    return filteredDets;

  } catch (err) {
    throw new Error(err);
  }
};

const mira = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox = label.bbox ? label.bbox : [0,0,1,1];

  try {
    let res = await agent
      .post(config['/ML/MIRA_API_URL'])
      .field('bbox', JSON.stringify(bbox))
      .attach('image', imgBuffer, image._id + '.jpg');
    res = JSON.parse(res.res.text);

    const filteredDets = Object.values(res).reduce((dets, classifier) => {
      // only evaluate top predictions
      const [category, conf] = Object.entries(classifier.predictions)
        .sort((a, b) => b[1] - a[1])[0];

      // filter out disabled detections,
      // empty detections, & detections below confThreshold
      // NOTE: we disregard "empty" class detections from MIRA classifiers
      // b/c we're using Megadetector to determine if objects are present
      const { disabled, confThreshold } = catConfig.find((cat) => (
        cat.name === category
      ));
      if (!disabled && category !== 'empty' && conf >= confThreshold) {
        dets.push({
          mlModel: modelSource._id,
          mlModelVersion: modelSource.version,
          type: 'ml',
          bbox,
          conf,
          category
        });
      }

      return dets;
    }, []);

    return filteredDets;

  } catch (err) {
    throw new Error(err);
  }
};

const modelInterfaces = new Map();
modelInterfaces.set('megadetector', megadetector);
modelInterfaces.set('mira', mira);

module.exports = {
  modelInterfaces
};
