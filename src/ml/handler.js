const { GraphQLClient, gql } = require('graphql-request');
const { runInference } = require('./inference');
const utils = require('../automation/utils');
const config = require('../config/config');
// const { createLabel } = require('../api/resolvers/Mutation');
const { SQS } = require('aws-sdk');

const sqs = new SQS();

async function requestCreateLabels(input) {
  console.log('calling requesCreateLabel for input: ', input);
  const mutation = gql`
    mutation CreateLabels($input: CreateLabelsInput!) {
      createLabels(input: $input) {
        image {
          labels {
            type
            category
            conf
            bbox
          }
        }
      }
    }
  `
  const variables = { input: input };
  try {
    const graphQLClient = new GraphQLClient(config.ANIML_API_URL, {
      // headers: {
      //   authorization: 'Bearer MY_TOKEN',
      // },
    });
    const createLabelResponse = await graphQLClient.request(mutation, variables);
    // console.log(JSON.stringify(createLabelResponse, undefined, 2));
    console.log('success calling requestCreateLabels: ', createLabelResponse)
    return createLabelResponse;
  } catch (err) {
    console.log('error calling requestCreateLabels: ', error)
    throw err;
  }
};



exports.inference = async (event, context) => {
  console.log('ML worker waking up:', JSON.stringify(event, null, 2));
  // poll for messages

  try {
    console.log('Polling for messages...');
    const data = await sqs.receiveMessage({
      QueueUrl: config.INFERENCE_QUEUE_URL,
      MaxNumberOfMessages: 10,
      VisibilityTimeout: 10,
      WaitTimeSeconds: 20
    }).promise();
    console.log('response from queue: ', data);
    
    // const messages = JSON.parse(data.Messages);
    for (const message of data.Messages) {
      console.log('message: ', message.Body);
      const { model, image, label } = JSON.parse(message.Body);
      // run inference
      const detections = await runInference[model.name](model, image, label);

      // if successful, make create label request
      const res = await requestCreateLabels({
        imageId: image._id, labels: detections
      });

      // remove from queue
      await sqs.deleteMessage({
        QueueUrl: config.INFERENCE_QUEUE_URL,
        ReceiptHandle: message.ReceiptHandle /* required */
      }).promise();
    }

    // return res;

  } catch (err) {
    console.log('error with inference worker');
    // TODO: do we throw a new error here or return one? Unclear how to ensure 
    // failure and keep message in the queue
    throw new Error(err);
  }
};