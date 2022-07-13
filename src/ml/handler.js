const { GraphQLClient, gql } = require('graphql-request');
const { runInference } = require('./inference');
const { getConfig } = require('../config/config');
const { SQS } = require('aws-sdk');

const sqs = new SQS();

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


exports.inference = async (event) => {
    const config = await getConfig();

    if (!event.Records.length) return;

    for (const record of event.Records) {
        const { modelSource, catConfig, image, label } = JSON.parse(record.body);

        console.log(`record body: ${record.body}`);

        // run inference
        const detections = await runInference[modelSource._id]({
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

    }
};
