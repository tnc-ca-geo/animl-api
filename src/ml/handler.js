const { GraphQLClient, gql } = require('graphql-request');
const { runInference } = require('./inference');
const { getConfig } = require('../config/config');
const { SQS } = require('aws-sdk');

const sqs = new SQS();

async function requestCreateLabels(input, config) {
  // TODO: there's no real reason to return all of that image data
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
  `
  const variables = { input: input };
  try {
    const graphQLClient = new GraphQLClient(config['/API/URL'], {
      headers: { 'x-api-key': config['APIKEY'] },
    });
    const createLabelResponse = await graphQLClient.request(mutation, variables);
    // console.log(JSON.stringify(createLabelResponse, undefined, 2));
    return createLabelResponse;
  } catch (err) {
    throw err;
  }
};


exports.inference = async (event, context) => {
  // poll for messages
  try {
    const config = await getConfig();
    const data = await sqs.receiveMessage({
      QueueUrl: config['/ML/INFERENCE_QUEUE_URL'],
      MaxNumberOfMessages: 10,
      VisibilityTimeout: 10,
      WaitTimeSeconds: 20
    }).promise();
    
    if (!data.Messages) {
      return; 
    }
    
    for (const message of data.Messages) {
      const { modelSource, catConfig, image, label } = JSON.parse(message.Body);

      console.log(`handler() - message body: ${message.Body}`)
      // TODO AUTH - update this to reflect new automation rule approach & schema
      
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
        const res = await requestCreateLabels({
          imageId: image._id,
          labels: detections,
        }, config);
        // TODO: gracefully handle failed label creation
      }

      // remove from queue
      await sqs.deleteMessage({
        QueueUrl: config['/ML/INFERENCE_QUEUE_URL'],
        ReceiptHandle: message.ReceiptHandle /* required */
      }).promise();
    }

  } catch (err) {
    // TODO: do we throw a new error here or return one? Unclear how to ensure 
    // failure and keep message in the queue
    throw err;
  }
};