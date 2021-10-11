const { ApolloError } = require('apollo-server-errors');
const { SQS } = require('aws-sdk');
const utils = require('./utils');
const { sendEmail } = require('./alerts');

const sqs = new SQS();

const executeRule = {
  'run-inference': async (rule, payload, context) => {
    // TODO: send MIRA requests to separate queue
    try {
      const models = await context.models.Model.getModels();
      const model = models.filter((m) => (
        m._id.toString() === rule.action.model.toString()
      ))[0];
      const message = { model, ...payload };
      return await sqs.sendMessage({
        QueueUrl: context.config['/ML/INFERENCE_QUEUE_URL'],
        MessageBody: JSON.stringify(message),
      }).promise();
    } catch (err) {
      throw new ApolloError(err);
    }
  },
  'send-alert': async (rule, payload, context) => {
    try {
      return await sendEmail(rule, payload.image, context);
    } catch (err) {
      throw new ApolloError(err)
    }
  }
};

const handleEvent = async (payload, context) => {
  try {
    const callstack = await utils.buildCallstack(payload, context);
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
