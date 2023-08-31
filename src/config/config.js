import { ApolloError } from 'apollo-server-errors';
import SM  from '@aws-sdk/client-secrets-manager';
import SSM from '@aws-sdk/client-ssm';

/*
 *  Local config values
 */

const localConfig = {
  TIME_FORMATS: {
    EXIF: 'yyyy:LL:dd HH:mm:ss'
  },
  EMAIL_ALERT_SENDER: 'tnc.iot.bot@gmail.com',
  CSV_EXPORT_ERROR_COLUMNS: [
    '_id',
    'created',
    'image',
    'batch',
    'path',
    'error'
  ],
  CSV_EXPORT_COLUMNS: [
    '_id',
    'originalFileName',
    'dateAdded',
    'dateTimeOriginal',
    'cameraId',
    'projectId',
    'make',
    'deploymentId',
    'deploymentName',
    'deploymentTimezone',
    'deploymentLat',
    'deploymentLong'
  ]
};

/*
 *  Remote config values & secrets to be fetched
 *  from SSM Parameter Store
 */

let cachedSSMParams = null;

const ssmNames = [
  `/db/mongo-db-url-${process.env.STAGE}`,
  `/frontend/url-${process.env.STAGE}`,
  `/api/url-${process.env.STAGE}`,
  `/images/url-${process.env.STAGE}`,
  `/ml/inference-queue-url-${process.env.STAGE}`,
  `/exports/exported-data-bucket-${process.env.STAGE}`,
  `/exports/export-queue-url-${process.env.STAGE}`,
  `/ml/megadetector-v5a-realtime-endpoint-${process.env.STAGE}`,
  `/ml/megadetector-v5a-batch-endpoint-${process.env.STAGE}`,
  `/ml/megadetector-v5b-realtime-endpoint-${process.env.STAGE}`,
  `/ml/megadetector-v5b-batch-endpoint-${process.env.STAGE}`,
  `/ml/mirav2-realtime-endpoint-${process.env.STAGE}`,
  `/ml/mirav2-batch-endpoint-${process.env.STAGE}`,
  `/ml/nzdoc-batch-endpoint-${process.env.STAGE}` // NOTE: currently only supporting batch endpoint for nzdoc
];

function formatSSMParams(ssmParams) {
  const formattedParams = {};
  for (const param of ssmParams.Parameters) {
    const key = param.Name
      .replace(`-${process.env.STAGE}`, '')
      .replace(/-/g, '_')
      .toUpperCase();
    formattedParams[key] = param.Value;
  }
  return formattedParams;
}

async function getConfig() {
  const ssm = new SSM.SSMClient({ region: process.env.REGION });

  if (!cachedSSMParams) {
    do {
      const res = await ssm.send(new SSM.GetParametersCommand({
        Names: ssmNames.splice(0, 10),
        WithDecryption: true
      }));

      if (!cachedSSMParams) {
        cachedSSMParams = res;
      } else {
        cachedSSMParams.Parameters.push(...res.Parameters);
        cachedSSMParams.InvalidParameters.push(...res.InvalidParameters);
      }
    } while (ssmNames.length);
  }

  const secrets = new SM.SecretsManagerClient({ region: process.env.REGION });

  try {
    const ssmParams = await cachedSSMParams;
    const secretsResponse = await secrets.send(new SM.GetSecretValueCommand({
      SecretId: `api-key-${process.env.STAGE}`
    }));

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
}

export {
  localConfig,
  getConfig
};
