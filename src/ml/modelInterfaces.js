import { buildImgUrl } from '../api/db/models/utils.js';
import SM from '@aws-sdk/client-sagemaker-runtime';

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

async function megadetector(params) {
  const { modelSource, catConfig, image, config } = params;
  const Body = await _getImage(image, config);

  const isBatch = image.batchId;
  const version = modelSource.version === 'v5.0a' ? 'V5A' : 'V5B';

  try {
    const EndpointName = config[`/ML/MEGADETECTOR_${version}_${isBatch ? 'BATCH' : 'REALTIME'}_ENDPOINT`];
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({ Body, EndpointName });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const detections = JSON.parse(body);
    console.log(`detections returned from megadetector endpoint for image ${image._id}: ${detections}`);

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
    console.log(`megadetector() ERROR on image ${image._id}: ${err}`);
    throw new Error(err);
  }
}

async function mirav2(params) {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox = label.bbox ? label.bbox : [0,0,1,1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox
  };

  const isBatch = image.batchId;

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/MIRAV2_${isBatch ? 'BATCH' : 'REALTIME'}_ENDPOINT`]
    });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`mirav2 predictions for image ${image._id}: ${predictions}`);

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
    console.log(`mirav2() ERROR on image ${image._id}: ${err}`);
    throw new Error(err);
  }
}

async function nzdoc(params) {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox = label.bbox ? label.bbox : [0,0,1,1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox
  };

  const isBatch = image.batchId;

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/NZDOC_${isBatch ? 'BATCH' : 'REALTIME'}_ENDPOINT`]
    });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`nzdoc predictions for image ${image._id}: ${predictions}`);

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
    console.log(`nzdoc() ERROR on image ${image._id}: ${err}`);
    throw new Error(err);
  }
}


const modelInterfaces = new Map();
modelInterfaces.set('megadetector_v5a', megadetector);
modelInterfaces.set('megadetector_v5b', megadetector);
modelInterfaces.set('mirav2', mirav2);
modelInterfaces.set('nzdoc', nzdoc);

export { modelInterfaces };
