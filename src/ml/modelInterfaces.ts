import { buildImgKey } from '../api/db/models/utils.js';
import type { LabelSchema } from '../api/db/schemas/shared/index.js';
import type { ImageSchema } from '../api/db/schemas/Image.js';
import S3 from '@aws-sdk/client-s3';
import SM from '@aws-sdk/client-sagemaker-runtime';
import sharp from 'sharp';
import { Config } from '../config/config.js';

// Convert [y1, x1, y2, x2] to [x, y, width, height]
const _toSpeciesNetFormat = (bbox: number[]): number[] => {
  const [y1, x1, y2, x2] = bbox;
  return [x1, y1, x2 - x1, y2 - y1];
};

// Convert [x, y, width, height] to [y1, x1, y2, x2]
const _toMegaDetectorFormat = (bbox: number[]): number[] => {
  const [x, y, width, height] = bbox;
  return [y, x, y + height, x + width];
};

const _getImage = async (image: ImageSchema, config: ModelInterfaceParams['config']) => {
  const bucket = config.SERVING_BUCKET;
  const key = buildImgKey(image);

  const s3 = new S3.S3Client();
  try {
    const res = await s3.send(new S3.GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await res.Body?.transformToByteArray();
    let imgBuffer = Buffer.from(body!);

    // resize image if it's over 2.8 MB
    if (image.imageBytes! > 2800000) {
      imgBuffer = await sharp(imgBuffer).resize({ width: 3500 }).toBuffer();
    }

    return imgBuffer;
  } catch (err) {
    throw new Error(err as string);
  }
};

// filter out disabled detections,
// empty detections, & detections below confThreshold
const _filterClassifierPredictions = (
  predictions: any,
  bbox: ModelInterfaceParams['label']['bbox'],
  catConfig: ModelInterfaceParams['catConfig'],
  modelSource: ModelInterfaceParams['modelSource'],
) => {
  const filteredDets: Detection[] = [];
  Object.keys(predictions).forEach((labelId) => {
    const conf = predictions[labelId];
    const { disabled, confThreshold } = catConfig.find((cat) => cat._id === labelId)!;
    if (!disabled && conf >= confThreshold) {
      filteredDets.push({
        mlModel: modelSource._id,
        mlModelVersion: modelSource.version,
        bbox,
        conf,
        labelId,
      });
    }
  });

  return filteredDets;
};

const megadetector: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, config } = params;
  const Body = await _getImage(image, config);

  const isBatch = image.batchId;
  let version = 'V5B'; 
  switch (modelSource.version) {
    case 'v1000.0.0-redwood':
      version = 'V1000_0_0_REDWOOD';
      break;
    case 'v5.0a':
      version = 'V5A';
      break;
    default:
      version = 'V5B';
      break;
  }

  try {
    const endpointKey = `/ML/MEGADETECTOR_${version}_${isBatch ? 'BATCH' : 'REALTIME'}_ENDPOINT` as keyof Config;
    const EndpointName: string = config[endpointKey];
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({ Body, EndpointName });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const detections: Array<{
      y1: number;
      x1: number;
      y2: number;
      x2: number;
      confidence: number;
      class: string;
    }> = JSON.parse(body);
    console.log(`detections returned from megadetector endpoint for image ${image._id}: ${body}`);

    const formatedDets: Detection[] = detections.map((det) => ({
      mlModel: modelSource._id,
      mlModelVersion: modelSource.version,
      bbox: [det.y1, det.x1, det.y2, det.x2],
      conf: det.confidence,
      labelId: catConfig.find((cat) => parseInt(cat._id) === parseInt(det.class))!._id,
    }));

    // filter out disabled detections & detections below confThreshold
    const filteredDets: Detection[] = formatedDets.filter((det) => {
      const { disabled, confThreshold } = catConfig.find((cat) => cat._id === det.labelId)!;
      return !disabled && det.conf! >= confThreshold;
    });

    // add "empty" detection
    if (filteredDets.length === 0) {
      filteredDets.push({
        mlModel: modelSource._id,
        mlModelVersion: modelSource.version,
        bbox: [0, 0, 1, 1],
        labelId: '0',
      });
    }

    return filteredDets;
  } catch (err) {
    console.log(`megadetector ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const mirav2: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/MIRAV2_${isBatch ? 'BATCH' : 'REALTIME'}_ENDPOINT`],
    });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`mirav2 predictions for image ${image._id}: ${body}`);
    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`mirav2 ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const nzdoc: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;

  if (!isBatch) {
    throw new Error('nzdoc does not support realtime processing');
  }

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/NZDOC_BATCH_ENDPOINT`],
    });
    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`nzdoc predictions for image ${image._id}: ${body}`);
    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`nzdoc ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const sdzwasouthwestv3: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/SDZWA_SOUTHWESTV3_${isBatch ? 'BATCH' : 'REALTIME'}_ENDPOINT`],
    });

    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`sdzwa-southwestv3 predictions for image ${image._id}: ${body}`);

    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`sdzwa-southwestv3 ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const sdzwaandesv1: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;
  if (!isBatch) {
    throw new Error('sdzwaandesv1 does not support realtime processing');
  }

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/SDZWA_ANDESV1_BATCH_ENDPOINT`],
    });

    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`sdzwa-andesv1 predictions for image ${image._id}: ${body}`);
    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`sdzwa-southwestv3 ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const deepfaunene: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;
  if (!isBatch) {
    throw new Error('deepfaune-ne does not support realtime processing');
  }

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/DEEPFAUNE_NE_BATCH_ENDPOINT`],
    });

    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`deepfaune-ne predictions for image ${image._id}: ${body}`);
    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`deepfaune-ne ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const speciesnet: InferenceFunction = async (params) => {
  console.log('speciesnet inference', params);
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);

  let mode = 'all';

  // Select the model mode based on modelSource._id
  if (modelSource._id == 'speciesnet-classifier') {
    console.log('running speciesnet in classifier mode');
    mode = 'classifier';
  }

  if (modelSource._id == 'speciesnet-all') {
    console.log('running speciesnet in all mode');
    mode = 'all';
  }

  let bbox: BBox = label?.bbox ? label.bbox : [0, 0, 1, 1];
  const speciesnetBbox: BBox = label?.bbox ? _toSpeciesNetFormat(label.bbox) : [0, 0, 1, 1];

  const payload = {
    image_data: imgBuffer.toString('base64'),
    bbox: speciesnetBbox,
    components: mode,
    ...(mode === 'all' && params.country && { country: params.country }),
    ...(mode === 'all' &&
      params.admin1Region && { admin1_region: params.admin1Region.split('-')[1] }),
  };

  // Choose the endpoint based on the mode. Default is realtime.
  let endpointName = config[`/ML/SPECIESNETV401A_REALTIME_ENDPOINT`];
  const isBatch = image.batchId;

  if (isBatch) {
    console.log('running speciesnet in batch mode', isBatch);
    endpointName = config[`/ML/SPECIESNETV401A_BATCH_ENDPOINT`];
  }

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: endpointName,
    });

    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const response = JSON.parse(body);
    console.log(`speciesnet predictions for image ${image._id}: ${body}`);

    let predictions: Record<string, number> = {};
    if (mode === 'all' && response.predictions[0].detections.length > 0) {
      // When in 'all' mode, get bbox from detections if available
      const detection = response.predictions[0].detections[0];
      bbox = _toMegaDetectorFormat(detection.bbox);

      // Get results from the prediction
      const uuid = response.predictions[0].prediction.split(';')[0];
      predictions[uuid] = response.predictions[0].prediction_score;
    }

    if (mode === 'classifier' && response.predictions[0].classifications.classes.length > 0) {
      // Use classification results. Transform predictions to match catConfig format using ids from speciesnet
      response.predictions[0].classifications.classes.forEach((classStr: string, index: number) => {
        const uuid = classStr.split(';')[0]; // Get just the id
        predictions[uuid] = response.predictions[0].classifications.scores[index];
      });
    }

    console.log('transformed speciesnet predictions:', predictions);
    // Return with md5 bbox
    let filteredDets = _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);

    // add "empty" detection if no detections are found (only relevant when running in 'all' mode)
    if (filteredDets.length === 0 && mode === 'all') {
      filteredDets.push({
        mlModel: modelSource._id,
        mlModelVersion: modelSource.version,
        bbox: [0, 0, 1, 1],
        labelId: '0',
      });
    }

    return filteredDets;
  } catch (err) {
    console.log(`speciesnet ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const ircv2: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;
  if (!isBatch) {
    throw new Error('ircv2 does not support realtime processing');
  }

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      ContentType: 'application/json', // NOTE: ContentType required to satisfy FastAPI/Pydantic input validation
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/IRCV2_BATCH_ENDPOINT`],
    });

    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`ircv2 predictions for image ${image._id}: ${body}`);
    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`ircv2 ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const cameraTrapVehicleClassifier: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;
  if (!isBatch) {
    throw new Error('camera-trap-vehicle-classifier does not support realtime processing');
  }

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/CAMERA_TRAP_VEHICLE_CLASSIFIER_BATCH_ENDPOINT`],
    });

    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`camera-trap-vehicle-classifier predictions for image ${image._id}: ${body}`);
    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`camera-trap-vehicle-classifier ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const alitav3: InferenceFunction = async (params) => {
  const { modelSource, catConfig, image, label, config } = params;
  const imgBuffer = await _getImage(image, config);
  const bbox: BBox = label.bbox ? label.bbox : [0, 0, 1, 1];
  const payload = {
    image: imgBuffer.toString('base64'),
    bbox: bbox,
  };

  const isBatch = image.batchId;
  if (!isBatch) {
    throw new Error('alitav3 does not support realtime processing');
  }

  try {
    const smr = new SM.SageMakerRuntimeClient({ region: process.env.REGION });
    const command = new SM.InvokeEndpointCommand({
      Body: JSON.stringify(payload),
      EndpointName: config[`/ML/ALITAV3_BATCH_ENDPOINT`],
    });

    const res = await smr.send(command);
    const body = Buffer.from(res.Body).toString('utf8');
    const predictions = JSON.parse(body);
    console.log(`alitav3 predictions for image ${image._id}: ${body}`);
    return _filterClassifierPredictions(predictions, bbox, catConfig, modelSource);
  } catch (err) {
    console.log(`alitav3 ERROR on image ${image._id}: ${err}`);
    throw new Error(err as string);
  }
};

const modelInterfaces = new Map<string, InferenceFunction>();
modelInterfaces.set('megadetector_v5a', megadetector);
modelInterfaces.set('megadetector_v5b', megadetector);
modelInterfaces.set('megadetector_v1000.0.0-redwood', megadetector);
modelInterfaces.set('mirav2', mirav2);
modelInterfaces.set('nzdoc', nzdoc);
modelInterfaces.set('sdzwa-southwestv3', sdzwasouthwestv3);
modelInterfaces.set('sdzwa-andesv1', sdzwaandesv1);
modelInterfaces.set('deepfaune-ne', deepfaunene);
modelInterfaces.set('ircv2', ircv2);
modelInterfaces.set('camera-trap-vehicle-classifier', cameraTrapVehicleClassifier);
modelInterfaces.set('alitav3', alitav3);
modelInterfaces.set('speciesnet-classifier', speciesnet);
modelInterfaces.set('speciesnet-all', speciesnet);

export { modelInterfaces };

export type Detection = Pick<
  LabelSchema,
  'mlModel' | 'mlModelVersion' | 'bbox' | 'conf' | 'labelId'
>;

type BBox = number[];

interface ModelInterfaceParams {
  modelSource: {
    _id: string;
    version: string;
  };
  catConfig: Array<{
    _id: string;
    disabled: boolean;
    confThreshold: number;
  }>;
  image: ImageSchema;
  label: LabelSchema;
  config: Config;
  country?: string; // Optional country code for speciesnet-all
  admin1Region?: string; // Optional admin1 region for speciesnet-all
}

interface InferenceFunction {
  (params: ModelInterfaceParams): Promise<Detection[]>;
}
