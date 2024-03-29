import { GraphQLClient, gql } from 'graphql-request';
import { modelInterfaces } from './modelInterfaces.js';
import { getConfig } from '../config/config.js';

async function requestCreateInternalLabels(input, config) {
  const variables = { input: input };
  const mutation = gql`
    mutation CreateInternalLabels($input: CreateInternalLabelsInput!) {
      createInternalLabels(input: $input) {
        isOk
      }
    }
  `;

  const graphQLClient = new GraphQLClient(
    config['/API/URL'],
    { headers: { 'x-api-key': config['APIKEY'] } }
  );

  return await graphQLClient.request(mutation, variables);
}

async function singleInference(config, record) {
  const { modelSource, catConfig, image, label } = JSON.parse(record.body);

  console.log(`message related to image ${image._id}: ${record.body}`);

  // run inference
  if (modelInterfaces.has(modelSource._id)) {
    const requestInference = modelInterfaces.get(modelSource._id);

    const detections = await requestInference({
      modelSource,
      catConfig,
      image,
      label,
      config
    });

    // if successful, make create label request
    if (detections.length) {
      try {
        await requestCreateInternalLabels({
          labels: detections.map((det) => ({ ...det, imageId: image._id }))
        }, config);
      } catch (err) {
        console.log(`requestCreateInternalLabels() ERROR on image ${image._id}: ${err}`);
        // don't fail messages that produce duplicate label errors
        // Note: hacky JSON parsing below due to odd error objects created by graphql-request client
        // https://github.com/jasonkuhrt/graphql-request/issues/201
        const errParsed = JSON.parse(JSON.stringify(err));
        const hasDuplicateLabelErrors = errParsed.response.errors.some((e) => (
          e.extensions.code === 'DUPLICATE_LABEL'
        ));
        if (!hasDuplicateLabelErrors) {
          throw err;
        }
      }
    }

  } else {
    // TODO: gracefully handle model not found
  }
}

async function inference(event) {
  const config = await getConfig();

  console.log('event: ', event);

  const batchItemFailures = [];
  if (!event.Records || !event.Records.length) {
    return { batchItemFailures };
  }

  const results = await Promise.allSettled(event.Records.map((record) => {
    return singleInference(config, record);
  }));

  console.log('results: ', results);

  for (let i = 0; i < results.length; i++) {
    if (!(results[i].reason instanceof Error)) continue;

    batchItemFailures.push({
      itemIdentifier: event.Records[i].messageId
    });
  }

  if (batchItemFailures.length > 0) {
    console.log('ERROR - batchItemFailures: ', batchItemFailures);
  }

  return { batchItemFailures };
}

export {
  inference
};
