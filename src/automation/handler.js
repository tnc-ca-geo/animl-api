const { GraphQLClient, gql } = require('graphql-request');
const { runInference } = require('./inference');
const { sendEmail } = require('./alerts');
const utils = require('./utils');
const config = require('../config/config');
const { createLabel } = require('../api/resolvers/Mutation');

async function getModels() {
  const query = gql`
    query GetModels {
      models {
        _id
        name
        description
        version
      }
    }
  `
  try {
    const graphQLClient = new GraphQLClient(config.ANIML_API_URL, {
      // headers: {
      //   authorization: 'Bearer MY_TOKEN',
      // },
    });
    const models = await graphQLClient.request(query);
    // console.log(JSON.stringify(createLabelResponse, undefined, 2));
    return models;
  } catch (err) {
    throw err;
  }
};

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

const executeRule = {
  'run-inference': async (rule, image) => {
    try {
      const { models } = await getModels();
      const model = models.filter((m) => m._id === rule.action.model)[0];
      const detections = await runInference[model.name](image, models);
      const res = await requestCreateLabels({ imageId: image._id, labels: detections })
      // const res = await Promise.all(detections.map(async (det) => {
      //   await requestCreateLabel({ imageId: image._id, label: det })
      // }));
      console.log('successfully requested labels for new detections: ', res);
      return res;
    } catch (err) {
      console.log('error running inference: ', err);
      throw new Error(err);
    }
  },
  'send-alert': async (rule, image) => {
    try {
      return await sendEmail(rule, image);
    } catch (err) {
      throw new Error(err)
    }
  }
};

exports.automation = async (event) => {
  try {
    for (const record of event.Records) {
      const { event, image, label, views } = JSON.parse(record.body);
      console.log('recieved automation processing request for image: ', image.originalFileName);
      // TODO: One big issue here is that you could potentiall have mulitple 
      // rules you need to execute for a given event, but if one fails, the 
      // lambda fails, and it will retry ALL rules again the next time around...
      const callstack = utils.buildCallstack(event, image, label, views);
      console.log(`automation callstack for ${image.originalFileName} contains ${callstack.length} rules:`);
      callstack.forEach((rule) => console.log('rule: ', rule));
      const res = await Promise.all(callstack.map(async (rule) => (
        await executeRule[rule.action.type](rule, image)
      )));
      console.log('returning result: ', res);
      return res;
    }
  } catch (err) {
    console.log('error processing request for image');
    // TODO: do we throw a new error here or return one? Unclear how to ensure 
    // failure and keep message in the queue
    throw new Error(err);
  }
};