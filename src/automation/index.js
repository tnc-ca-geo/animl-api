const { ApolloError } = require('apollo-server-errors');
const { SQS } = require('aws-sdk');
const utils = require('./utils');
const { sendEmail } = require('./alerts');

const sqs = new SQS();

const executeRule = {

  'run-inference': async (rule, payload, context) => {
    try {
      const mlModel = rule.action.mlModel;
      const modelSources = await context.models.MLModel.getMLModels([mlModel]);
      const modelSource = modelSources[0];
      const catConfig = utils.buildCatConfig(modelSource, rule);

      const message = { modelSource, catConfig, ...payload };
      return await sqs.sendMessage({
        QueueUrl: context.config['/ML/INFERENCE_QUEUE_URL'],
        MessageBody: JSON.stringify(message)
      }).promise();

    } catch (err) {
      throw new ApolloError(err);
    }
  },

  'send-alert': async (rule, payload, context) => {
    try {
      return await sendEmail(rule, payload.image, context);
    } catch (err) {
      throw new ApolloError(err);
    }
  }
};

const handleEvent = async (payload, context) => {
  try {
    const callstack = await utils.buildCallstack(payload, context);
    if (callstack.length === 0) return;

    await Promise.all(callstack.map(async (rule) => (
      await executeRule[rule.action.type](rule, payload, context)
    )));

  } catch (err) {
    throw new ApolloError(err);
  }
};

module.exports = {
  handleEvent
};
