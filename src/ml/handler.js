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

async function requestPriority(config) {
  const mutation = gql`
    query Priority {
      priorityStatus {
        priority
      }
    }
  `;

  const graphQLClient = new GraphQLClient(
    config['/API/URL'],
    { headers: { 'x-api-key': config['APIKEY'] } }
  );

  return await graphQLClient.request(mutation);
}


exports.inference = async (event) => {
  const config = await getConfig();

  console.log('event: ', event);

  if (!event.Records || !event.Records.length) return;

  for (const record of event.Records) {
    const { modelSource, catConfig, image, label } = JSON.parse(record.body);

    console.log(`record body: ${record.body}`);

    // run inference
    if (modelInterfaces.has(modelSource._id)) {
      const requestInference = modelInterfaces.get(modelSource._id);

      if (image.batchId) {
        // Ensure manually uploaded images get priority
        const priority = (await requestPriority(config)).priorityStatus.priority;
        if (priority > 10) return;
      }

      const detections = await requestInference({
        modelSource,
        catConfig,
        image,
        label,
        config
      });

      // if successful, make create label request
      if (detections.length) {
        await requestCreateLabels({
          imageId: image._id,
          labels: detections
        }, config);
        // TODO: gracefully handle failed label creation
      }

    } else {
      // TODO: gracefully handle model not found
    }
  }
};
