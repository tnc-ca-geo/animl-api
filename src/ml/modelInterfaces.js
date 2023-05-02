const { buildImgUrl } = require('../api/db/models/utils');
const SM = require('@aws-sdk/client-sagemaker-runtime');

const _getImage = async (image, config) => {
  const url = 'http://' + buildImgUrl(image, config);

  try {
    const res = await fetch(url);
    const body = await res.arrayBuffer();
    return Buffer.from(body, 'binary');
  } catch (err) {
    throw new Error(err);
  }
};

const megadetector = async (params) => {
  const { modelSource, catConfig, image, config } = params;
  const imgBuffer = await _getImage(image, config);

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
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

const mirav2 = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox = label.bbox ? label.bbox : [0,0,1,1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox
  };

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config['/ML/MIRAV2_SAGEMAKER_NAME']
    });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log('mirav2 predictions: ', predictions);

    const filteredDets = [];
    Object.keys(predictions).forEach((category) => {
      // filter out disabled detections,
      // empty detections, & detections below confThreshold
      const conf = predictions[category];
      const { disabled, confThreshold } = catConfig.find((cat) => cat.name === category);
      if (!disabled && conf >= confThreshold) {
        filteredDets.push({
          mlModel: modelSource._id,
          mlModelVersion: modelSource.version,
          type: 'ml',
          bbox,
          conf,
          category
        });
      }
    });

    return filteredDets;

  } catch (err) {
    throw new Error(err);
  }
};

const nzdoc = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox = label.bbox ? label.bbox : [0,0,1,1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox
  };

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config['/ML/NZDOC_SAGEMAKER_NAME']
    });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log('nzdoc predictions: ', predictions);

    const filteredDets = [];
    Object.keys(predictions).forEach((category) => {
      // filter out disabled detections,
      // empty detections, & detections below confThreshold
      const conf = predictions[category];
      const { disabled, confThreshold } = catConfig.find((cat) => cat.name === category);
      if (!disabled && conf >= confThreshold) {
        filteredDets.push({
          mlModel: modelSource._id,
          mlModelVersion: modelSource.version,
          type: 'ml',
          bbox,
          conf,
          category
        });
      }
    });

    return filteredDets;

  } catch (err) {
    throw new Error(err);
  }
};


const modelInterfaces = new Map();
modelInterfaces.set('megadetector', megadetector);
modelInterfaces.set('mirav2', mirav2);
modelInterfaces.set('nzdoc', nzdoc);

module.exports = {
  modelInterfaces
};
