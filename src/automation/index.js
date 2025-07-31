import SQS from '@aws-sdk/client-sqs';
import { InternalServerError } from '../api/errors.js';
import { buildCallstack } from './utils.js';
import { sendEmail } from './alerts.js';

const sqs = new SQS.SQSClient();

const executeRule = {
  'run-inference': async (rule, payload, context) => {
    try {
      const mlModelId = rule.action.mlModel;
      const message = {
        mlModelId,
        ...payload,
        projectId: payload.image.projectId,
        automationRuleId: rule._id.toString(),
      };
      payload.image.awaitingPrediction = true;
      payload.image.save();

      if (payload.image.batchId) {
        return await sqs.send(
          new SQS.SendMessageCommand({
            QueueUrl: `https://sqs.${process.env.AWS_DEFAULT_REGION}.amazonaws.com/${process.env.ACCOUNT}/animl-ingest-${process.env.STAGE}-${payload.image.batchId}`,
            MessageBody: JSON.stringify(message),
          }),
        );
      } else {
        return await sqs.send(
          new SQS.SendMessageCommand({
            QueueUrl: context.config['/ML/INFERENCE_QUEUE_URL'],
            MessageBody: JSON.stringify(message),
          }),
        );
      }
    } catch (err) {
      throw new InternalServerError(err instanceof Error ? err.message : String(err));
    }
  },

  'send-alert': async (rule, payload, context) => {
    try {
      return await sendEmail(rule, payload.image, context);
    } catch (err) {
      throw new InternalServerError(err instanceof Error ? err.message : String(err));
    }
  },
};

const handleEvent = async (payload, context) => {
  try {
    const callstack = await buildCallstack(payload, context);
    if (callstack.length === 0) return;
    console.log(`automation rule callstack for ${payload.image.originalFileName}: `, callstack);

    await Promise.all(
      callstack.map(async (rule) => await executeRule[rule.action.type](rule, payload, context)),
    );
  } catch (err) {
    throw new InternalServerError(err instanceof Error ? err.message : String(err));
  }
};

export { handleEvent };
