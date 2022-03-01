const { ApolloError } = require('apollo-server-errors');
const { SQS } = require('aws-sdk');
const utils = require('./utils');
const { sendEmail } = require('./alerts');

const sqs = new SQS();

const executeRule = {
  'run-inference': async (rule, payload, context) => {
    console.log(`automation.executeRule() - rule: ${rule}`);
    console.log(`automation.executeRule() - payload: ${JSON.stringify(payload)}`);

    // TODO: send MIRA requests to separate queue
    // NEW - update this to reflect new automation rule approach & schema
    try {
      const { mlModel, confThreshold, categoryConfig }  = rule.action;
      // const projectId = payload.image.project;
      const modelSources = await context.models.MLModel.getMLModels([mlModel]);
      const modelSource = modelSources[0];
      // NEW - we also need to determine category config from a combo of
      // the modelSource (default) and automationRule.action data
      const catConfig = modelSource.categories.map((catSource) => {
        const config = categoryConfig && categoryConfig[catSource.name];
        const thresh = (config && config.confThreshold) || // automation rule, category level override
                       confThreshold || // automation rule, model level setting
                       modelSource.defaultConfThreshold;  // model source, default setting
        return {
          _id: catSource._id, // _id native to the model (i.e. _id 1 === 'animal')
          name: catSource.name, // human readable category name
          disabled: config && config.disabled,
          confThreshold: thresh,
        }
      });
      
      const message = { modelSource, catConfig, ...payload }; // NEW
      console.log(`automation.executeRule['run-inference']() - message: ${JSON.stringify(message)}`);
      return await sqs.sendMessage({
        QueueUrl: context.config['/ML/INFERENCE_QUEUE_URL'],
        MessageBody: JSON.stringify(message),
      }).promise();
    } catch (err) {
      throw new ApolloError(err);
    }
  },
  'send-alert': async (rule, payload, context) => {
    console.log(`automation.executeRule() - rule: ${rule}`);
    console.log(`automation.executeRule() - payload: ${payload}`);

    try {
      return await sendEmail(rule, payload.image, context);
    } catch (err) {
      throw new ApolloError(err)
    }
  }
};

const handleEvent = async (payload, context) => {
  console.log(`automation.handleEvent() - payload: ${payload}`);
  try {
    const callstack = await utils.buildCallstack(payload, context);
    console.log(`automation.handleEvent() - callstack: ${callstack}`);
    if (callstack.length > 0) {
      await Promise.all(callstack.map(async (rule) => (
        await executeRule[rule.action.type](rule, payload, context)
      )));
    }
  } catch (err) {
    throw new ApolloError(err);
  }
};

module.exports = {
  handleEvent,
};
