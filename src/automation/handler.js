const { GraphQLClient, gql } = require('graphql-request');
const { runInference } = require('./inference');
const { sendEmail } = require('./alerts');
const utils = require('./utils');
const config = require('../config/config');

async function requestCreateLabel(input) {
  const mutation = gql`
    mutation CreateLabel($input: CreateLabelInput!) {
      createLabel(input: $input) {
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
    return createLabelResponse;
  } catch (err) {
    throw err;
  }
};

const executeRule = {
  'run-inference': async (rule, image) => {
    try {
      const detections = await runInference[rule.action.model.name](image);
      await Promise.all(detections.map(async (det) => {
        det.modelId = rule.action.model._id;
        det.type = 'ml';
        await requestCreateLabel({ imageId: image._id, label: det });
      }));
    } catch (err) {
      throw new Error(err);
    }
  },
  'send-alert': (rule, image) => {
    console.log('sending alert: ', rule);
    sendEmail(rule, image);
  }
};

exports.automation = async (event) => {
  let res;
  try {
    for (const record of event.Records) {
      const { event, image, label, views } = JSON.parse(record.body);
      const callstack = utils.buildCallstack(event, image, label, views);
      await Promise.all(callstack.map(async (rule) => {
        await executeRule[rule.action.type](rule, image);
      }));
    }
  } catch (error) {
    console.log(error);
  }
  return res;
};