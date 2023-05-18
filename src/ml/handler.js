const { GraphQLClient, gql } = require('graphql-request');
const { modelInterfaces } = require('./modelInterfaces');
const { getConfig } = require('../config/config');

async function requestCreateLabels(input, config) {
  const variables = { input: input };
  const mutation = gql`
    mutation CreateLabels($input: CreateLabelsInput!) {
      createLabels(input: $input) {
        image {
          objects {
            bbox
            labels {
              type
              category
              conf
              bbox
            }
          }
        }
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

  console.log(`record body: ${record.body}`);

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
        await requestCreateLabels({
          imageId: image._id,
          labels: detections
        }, config);
      } catch (err) {
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

exports.inference = async (event) => {
  const config = await getConfig();

  console.log('event: ', event);

  const batchItemFailures = [];
  if (!event.Records || !event.Records.length) {
    return { batchItemFailures };
  }

  const results = await Promise.allSettled(event.Records.map((record) => {
    return singleInference(config, record);
  }));


  for (let i = 0; i < results.length; i++) {
    if (!(results[i] instanceof Error)) continue;

    batchItemFailures.push({
      itemIdentifier: event.Records[i].messageId
    });
  }

  return { batchItemFailures };
};
