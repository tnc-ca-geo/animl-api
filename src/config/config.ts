import { GraphQLError } from 'graphql';
import { ApolloServerErrorCode } from '@apollo/server/errors';
import SM from '@aws-sdk/client-secrets-manager';
import SSM from '@aws-sdk/client-ssm';

/*
 *  Local config values
 */

const localConfig = {
  TIME_FORMATS: {
    EXIF: 'yyyy:LL:dd HH:mm:ss',
  },
  EMAIL_ALERT_SENDER: 'tnc.iot.bot@gmail.com',
  CSV_EXPORT_ERROR_COLUMNS: ['_id', 'created', 'image', 'batch', 'path', 'error'],
  CSV_EXPORT_COLUMNS: [
    '_id',
    'originalFileName',
    'path',
    'dateAdded',
    'dateTimeOriginal',
    'cameraId',
    'projectId',
    'make',
    'deploymentId',
    'deploymentName',
    'deploymentTimezone',
    'deploymentLat',
    'deploymentLong',
    'comments',
  ],
};

/*
 *  Remote config values & secrets to be fetched
 *  from SSM Parameter Store
 */

let cachedSSMParams: SSM.GetParametersCommandOutput | null = null;

const ssmNames = [
  '/application/cognito/userPoolId',
  `/db/mongo-db-url-${process.env.STAGE}`,
  `/frontend/url-${process.env.STAGE}`,
  `/api/url-${process.env.STAGE}`,
  `/images/url-${process.env.STAGE}`,
  `/images/cloudfront-distribution-privatekey-${process.env.STAGE}`,
  `/ml/inference-queue-url-${process.env.STAGE}`,
  `/exports/exported-data-bucket-${process.env.STAGE}`,
  `/tasks/task-queue-url-${process.env.STAGE}`,
  `/ml/megadetector-v5a-realtime-endpoint-${process.env.STAGE}`,
  `/ml/megadetector-v5a-batch-endpoint-${process.env.STAGE}`,
  `/ml/megadetector-v5b-realtime-endpoint-${process.env.STAGE}`,
  `/ml/megadetector-v5b-batch-endpoint-${process.env.STAGE}`,
  `/ml/mirav2-realtime-endpoint-${process.env.STAGE}`,
  `/ml/mirav2-batch-endpoint-${process.env.STAGE}`,
  `/ml/nzdoc-batch-endpoint-${process.env.STAGE}`, // NOTE: currently only supporting batch endpoint for nzdoc
  `/ml/sdzwa-southwestv3-batch-endpoint-${process.env.STAGE}`,
  `/ml/sdzwa-southwestv3-realtime-endpoint-${process.env.STAGE}`,
  `/ml/sdzwa-andesv1-batch-endpoint-${process.env.STAGE}`, // NOTE: currently only supporting batch endpoint for andesv1
  `/ml/deepfaune-ne-batch-endpoint-${process.env.STAGE}`, // NOTE: currently only supporting batch endpoint for deepfaune-ne
  `/ml/speciesnetv401a-realtime-endpoint-${process.env.STAGE}`,
  `/ml/speciesnetv401a-batch-endpoint-${process.env.STAGE}`,
];

function formatSSMParams<T>(ssmParams: SSM.GetParametersCommandOutput): T {
  const formattedParams: Record<string, string> = {};
  for (const param of ssmParams.Parameters ?? []) {
    const key = param.Name!.replace(`-${process.env.STAGE}`, '').replace(/-/g, '_').toUpperCase();
    formattedParams[key] = param.Value!;
  }
  return formattedParams as T;
}

async function getConfig(): Promise<Config> {
  const ssm = new SSM.SSMClient({ region: process.env.REGION });

  if (!cachedSSMParams) {
    do {
      const res = await ssm.send(
        new SSM.GetParametersCommand({
          Names: ssmNames.splice(0, 10),
          WithDecryption: true,
        }),
      );

      if (!cachedSSMParams) {
        cachedSSMParams = res;
      } else {
        cachedSSMParams.Parameters?.push(...(res.Parameters ?? []));
        cachedSSMParams.InvalidParameters?.push(...(res.InvalidParameters ?? []));
      }
    } while (ssmNames.length);
  }

  const secrets = new SM.SecretsManagerClient({ region: process.env.REGION });

  try {
    const ssmParams = await cachedSSMParams;
    const secretsResponse = await secrets.send(
      new SM.GetSecretValueCommand({
        SecretId: `api-key-${process.env.STAGE}`,
      }),
    );

    const secret = JSON.parse(secretsResponse.SecretString || '{}');
    if (ssmParams.InvalidParameters?.length! > 0) {
      const invalParams = ssmParams.InvalidParameters?.join(', ');

      throw new GraphQLError(`invalid parameter(s) requested: ${invalParams}`, {
        extensions: { code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR },
      });
    }
    const remoteConfig = formatSSMParams<RemoteConfig>(ssmParams);
    const secretConfig = {
      APIKEY: secret.apikey,
    };
    // const secretConfig = formatSSMParams(secret);
    return { ...localConfig, ...remoteConfig, ...secretConfig };
  } catch (err) {
    throw new GraphQLError(err instanceof Error ? err.message : String(err), {
      extensions: { code: ApolloServerErrorCode.INTERNAL_SERVER_ERROR },
    });
  }
}

// Values retrieved from AWS SSM Parameter Store
export interface RemoteConfig {
  '/API/URL': string;
  '/APPLICATION/COGNITO/USERPOOLID': string;
  '/DB/MONGO_DB_URL': string;
  '/EXPORTS/EXPORTED_DATA_BUCKET': string;
  '/FRONTEND/URL': string;
  '/IMAGES/URL': string;
  '/IMAGES/CLOUDFRONT_DISTRIBUTION_PRIVATEKEY': string;
  '/ML/INFERENCE_QUEUE_URL': string;
  '/ML/MEGADETECTOR_V5A_BATCH_ENDPOINT': string;
  '/ML/MEGADETECTOR_V5A_REALTIME_ENDPOINT': string;
  '/TASKS/TASK_QUEUE_URL': string;
  '/ML/MEGADETECTOR_V5B_BATCH_ENDPOINT': string;
  '/ML/MEGADETECTOR_V5B_REALTIME_ENDPOINT': string;
  '/ML/MIRAV2_BATCH_ENDPOINT': string;
  '/ML/MIRAV2_REALTIME_ENDPOINT': string;
  '/ML/NZDOC_BATCH_ENDPOINT': string;
  '/ML/SDZWA_SOUTHWESTV3_BATCH_ENDPOINT': string;
  '/ML/SDZWA_SOUTHWESTV3_REALTIME_ENDPOINT': string;
  '/ML/SDZWA_ANDESV1_BATCH_ENDPOINT': string;
  '/ML/DEEPFAUNE_NE_BATCH_ENDPOINT': string;
  '/ML/SPECIESNETV401A_REALTIME_ENDPOINT': string;
  '/ML/SPECIESNETV401A_BATCH_ENDPOINT': string;
}

// Values retrieved from AWS Secrets Manager
interface SecretConfig {
  APIKEY: any;
}

export type Config = typeof localConfig & RemoteConfig & SecretConfig;

export { localConfig, getConfig };
