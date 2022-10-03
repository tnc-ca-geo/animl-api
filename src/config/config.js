const { ApolloError } = require('apollo-server-errors');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { SSMClient, GetParametersCommand } = require('@aws-sdk/client-ssm');
const ssm = new SSMClient({ region: process.env.REGION });
const secrets = new SecretsManagerClient({ region: process.env.REGION });

/*
 *  Local config values
 */

const localConfig = {
  TIME_FORMATS: {
    EXIF: 'YYYY:MM:DD HH:mm:ss'
  },
  EMAIL_ALERT_SENDER: 'tnc.iot.bot@gmail.com'
};

/*
 *  Remote config values & secrets to be fetched
 *  from SSM Parameter Store
 */

let cachedSSMParams = null;

// TODO: Update all of these with new SSM param names
const ssmNames = [
  `/db/mongo-db-url-${process.env.STAGE}`,
  `/frontend/url-${process.env.STAGE}`,
  `/api/url-${process.env.STAGE}`,
  `/images/url-${process.env.STAGE}`,
  `/ml/inference-queue-url-${process.env.STAGE}`,
  `/ml/mira-api-url-${process.env.STAGE}`,
  `/ml/megadetector-sagemaker-name-${process.env.STAGE}`,
  `/exports/exported-data-bucket-${process.env.STAGE}`
];

const formatSSMParams = (ssmParams) => {
  const formattedParams = {};
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
    // cachedSSMParams = ssm.getParameters({
    //   Names: ssmNames,
    //   WithDecryption: true
    // }).promise();
    const command = new GetParametersCommand({
      Names: ssmNames,
      WithDecryption: true
    });
    cachedSSMParams = await ssm.send(command);
  }

  try {
    const ssmParams = await cachedSSMParams;

    // const secretsResponse = await secrets.getSecretValue({
    //   SecretId: `api-key-${process.env.STAGE}`
    // }).promise();

    const command = new GetSecretValueCommand({
      SecretId: `api-key-${process.env.STAGE}`
    });
    const secretsResponse = await secrets.send(command);
    const secret = JSON.parse(secretsResponse.SecretString || '{}');
    if (ssmParams.InvalidParameters.length > 0) {
      const invalParams = ssmParams.InvalidParameters.join(', ');
      throw new ApolloError(`invalid parameter(s) requested: ${invalParams}`);
    }
    const remoteConfig = formatSSMParams(ssmParams);
    const secretConfig = {
      'APIKEY': secret.apikey
    };
    // const secretConfig = formatSSMParams(secret);
    return { ...localConfig, ...remoteConfig, ...secretConfig };
  } catch (err) {
    throw new ApolloError(err);
  }
};

module.exports = {
  localConfig,
  getConfig
};

