const { SQS } = require('aws-sdk');
const utils = require('./utils');
const { sendEmail } = require('./alerts');

const sqs = new SQS();

const executeRule = {
  'run-inference': async (rule, payload, context) => {
    console.log(`executeRule['run-inference']() - Sending ${payload.image.originalFileName} to inference queue`);

    try {
      const models = await context.models.Model.getModels();
      const model = models.filter((m) => (
        m._id.toString() === rule.action.model.toString()
      ))[0];
      const message = { model, ...payload };
      return await sqs.sendMessage({
        QueueUrl: context.config.INFERENCE_QUEUE_URL,
        MessageBody: JSON.stringify(message),
      }).promise();
    } catch (err) {
      console.log('error running inference: ', err);
      throw new Error(err);
    }
  },
  'send-alert': async (rule, payload, context) => {
    console.log(`executeRule['send-alert']() - Sending ${payload.image.originalFileName} alert`);
    try {
      return await sendEmail(rule, payload.image, context.config);
    } catch (err) {
      throw new Error(err)
    }
  }
};

const handleEvent = async (payload, context) => {
  console.log(`automation.handleEvent() - Handling ${payload.image.originalFileName} event ${payload.event}`);
  try {
    const callstack = await utils.buildCallstack(payload, context);
    console.log('automation.handleEvent() - callstack: ', callstack);
    await Promise.all(callstack.map(async (rule) => (
      await executeRule[rule.action.type](rule, payload, context)
    )));
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  handleEvent,
};
