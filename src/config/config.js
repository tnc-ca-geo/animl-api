const { ApolloError } = require('apollo-server-errors');
const { SSM, SecretsManager } = require('aws-sdk');
const ssm = new SSM({ region: process.env.REGION });
const secrets = new SecretsManager({ region: process.env.REGION });

// Local config values

const localConfig = {
  MEGADETECTOR_CONF_THRESHOLD: 0.8,
  MEGADETECTOR_CATEGORIES: [
    { id: 1, name: 'animal' },
    { id: 2, name: 'person' },
    { id: 3, name: 'vehicle' },
  ],
  TIME_FORMATS: {
    EXIF: 'YYYY:MM:DD HH:mm:ss',
  },
  EMAIL_ALERT_SENDER: 'tnc.iot.bot@gmail.com'
};

// Remote config values & secrets to be fetched 
// from SSM Parameter Store

let cachedSSMParams = null;

// TODO: Update all of these with new SSM param names
const ssmNames = [
  `/db/mongo-db-url-${process.env.STAGE}`,
  `/frontend/url-${process.env.STAGE}`,
  `/api/url-${process.env.STAGE}`,
  `/images/url-${process.env.STAGE}`,
  `/ml/inference-queue-url-${process.env.STAGE}`,
  `/ml/mira-api-url-${process.env.STAGE}`,
  `/ml/megadetector-api-url-${process.env.STAGE}`,
  `/ml/megadetector-api-key`,
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

const getConfig = async function getConfig() {
  if (!cachedSSMParams) {
    cachedSSMParams = ssm.getParameters({
      Names: ssmNames,
      WithDecryption: true,
    }).promise();
  }

  try {
    const ssmParams = await cachedSSMParams;

    const secretsResponse = await secrets.getSecretValue({
        SecretId: `api-key-${process.env.STAGE}`,
    }).promise();
    const secret = JSON.parse(secretsResponse.SecretString || '{}');
    if (ssmParams.InvalidParameters.length > 0) {
      const invalParams = ssmParams.InvalidParameters.join(', ');
      throw new ApolloError(`invalid parameter(s) requested: ${invalParams}`);
    }
    const remoteConfig = formatSSMParams(ssmParams);
    const secretConfig = {
        'APIKEY': secret.apikey,
    }
    // const secretConfig = formatSSMParams(secret);
    return { ...localConfig, ...remoteConfig, ...secretConfig };
  } catch (err) {
    console.log('error getting config: ', err);
    throw new ApolloError(err);
  }
};

module.exports = {
  localConfig,
  getConfig,
};

