const { SSM } = require('aws-sdk');
const ssm = new SSM({ region: process.env.REGION });

// Local config values

const localConfig = {
  MEGADETECTOR_CONF_THRESHOLD: 0.8,
  MEGADETECTOR_CATEGORIES: [
    { id: 1, name: 'animal' },
    { id: 2, name: 'person' },
    { id: 3, name: 'vehicle' },
  ],
  TIME_FORMATS: {
    EXIF: 'YYYY:MM:DD hh:mm:ss',
  },
  EMAIL_ALERT_SENDER: 'tnc.iot.bot@gmail.com'
};

// Remote config values & secrets to be fetched 
// from SSM Parameter Store

let cachedSSMParams = null;

const ssmNames = [
  `mongo-db-url-${process.env.STAGE}`,
  `animl-api-url-${process.env.STAGE}`,
  `animl-images-url-${process.env.STAGE}`,
  `inference-queue-url-${process.env.STAGE}`,
  `mira-api-url-${process.env.STAGE}`,
  `megadetector-api-url`,
  `megadetector-api-key`,
];

const formatSSMParams = (ssmParams) => {
  let formattedParams = {};
  for (const param of ssmParams.Parameters) {
    const key = param.Name
      .replace(`-${process.env.STAGE}`, '')
      .replace(/-/g, '_')
      .toUpperCase();
    formattedParams[key] = param.Value;
  }
  return formattedParams;
};

module.exports.getConfig = async function getConfig() {
  if (!cachedSSMParams) {
    cachedSSMParams = ssm.getParameters({
      Names: ssmNames,
      WithDecryption: true,
    }).promise();
  }

  try {
    const ssmParams = await cachedSSMParams;
    if (ssmParams.InvalidParameters.length > 0) {
      const invalParams = ssmParams.InvalidParameters.join(', ');
      throw new Error(`invalid parameter(s) requested: ${invalParams}`);
    }
    const remoteConfig = formatSSMParams(ssmParams);
    return { ...localConfig, ...remoteConfig };
  } catch (err) {
    console.log('error getting config: ', err);
    throw new Error(err);
  }
};

