const { ApolloError } = require('apollo-server-errors');
const { SQS } = require('aws-sdk');
const utils = require('./utils');
const { sendEmail } = require('./alerts');

const sqs = new SQS();

const executeRule = {

  'run-inference': async (rule, payload, context) => {
    console.log(`automation.executeRule() - rule: ${rule}`);
    console.log(`automation.executeRule() - payload: ${JSON.stringify(payload)}`);

    try {

      const mlModel = rule.action.mlModel;
      const modelSources = await context.models.MLModel.getMLModels([mlModel]);
      const modelSource = modelSources[0];
      console.log(`automation.executeRule() - modelSource ${JSON.stringify(modelSource)}`);
      const catConfig = utils.buildCatConfig(modelSource, rule);

      const message = { modelSource, catConfig, ...payload };
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
    console.log(`automation.executeRule() - payload: ${JSON.stringify(payload)}`);

    try {
      return await sendEmail(rule, payload.image, context);
    } catch (err) {
      throw new ApolloError(err)
    }
  }
};

const handleEvent = async (payload, context) => {
  console.log(`automation.handleEvent() - payload: ${JSON.stringify(payload)}`);

  try {
    const callstack = await utils.buildCallstack(payload, context);
    console.log(`automation.handleEvent() - callstack: ${JSON.stringify(callstack)}`);
    if (callstack.length === 0) return;

    await Promise.all(callstack.map(async (rule) => (
      await executeRule[rule.action.type](rule, payload, context)
    )));
    
  } catch (err) {
    throw new ApolloError(err);
  }
};

module.exports = {
  handleEvent,
};
