import tape from 'tape';
import Sinon from 'sinon';
import SQS from '@aws-sdk/client-sqs';
import { DateTime } from 'luxon';
import MockConfig from './lib/config.js';
import TaskSchema from '../.build/api/db/schemas/Task.js';
import { TaskModel } from '../.build/api/db/models/Task.js';

const QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/123456789012/taskQueue-test';

const context = {
  user: { sub: 'user@example.com', curr_project: 'project' },
  config: { '/TASKS/TASK_QUEUE_URL': QUEUE_URL },
};

// Captures SQS SendMessage commands without hitting the network
const stubSqs = () => {
  const sent = [];
  Sinon.stub(SQS.SQSClient.prototype, 'send').callsFake(async (command) => {
    sent.push(command.input);
    return {};
  });
  return sent;
};

const makeInput = (config) => ({
  user: 'user@example.com',
  projectId: 'project',
  type: 'DeleteImagesByFilter',
  config,
});

tape('TaskModel.create: persists config on the Task document', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);
    Sinon.stub(TaskSchema.prototype, 'save').callsFake(async function () {
      return this;
    });
    stubSqs();

    const config = { filters: { cameras: ['camera1'] } };
    const task = await TaskModel.create(makeInput(config), context);

    t.deepEquals(task.config, config, 'Config should be stored on the doc, not just the message');
    t.equal(task.projectId, 'project');
    t.equal(task.type, 'DeleteImagesByFilter');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('TaskModel.create: sends only a pointer in the SQS message body', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);
    Sinon.stub(TaskSchema.prototype, 'save').callsFake(async function () {
      return this;
    });
    const sent = stubSqs();

    // Large enough that including it would blow SQS's 256KB body limit
    const imageIds = Array.from({ length: 50000 }, (_, i) => `project:${'a'.repeat(32)}${i}`);
    const task = await TaskModel.create(makeInput({ imageIds }), context);

    t.equal(sent.length, 1, 'Should send one message');
    t.equal(sent[0].QueueUrl, QUEUE_URL);

    const body = JSON.parse(sent[0].MessageBody);
    t.deepEquals(
      Object.keys(body).sort(),
      ['_id', 'projectId'],
      'Body should carry nothing but a pointer to the Task',
    );
    t.equal(body._id, task._id.toString());
    t.equal(body.projectId, 'project');
    t.ok(
      Buffer.byteLength(sent[0].MessageBody) < 256 * 1024,
      'Body must stay under the 256KB SQS limit regardless of config size',
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('TaskModel.create: tags DateTimes in config', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);
    Sinon.stub(TaskSchema.prototype, 'save').callsFake(async function () {
      return this;
    });
    stubSqs();

    const iso = '2024-01-01T12:00:00.000Z';
    const task = await TaskModel.create(
      makeInput({ filters: { createdStart: DateTime.fromISO(iso) } }),
      context,
    );

    t.equal(
      typeof task.config.filters.createdStart.__DateTime__,
      'string',
      'A Luxon DateTime would otherwise be stored as a nested BSON document',
    );
    t.equal(
      DateTime.fromISO(task.config.filters.createdStart.__DateTime__).toMillis(),
      DateTime.fromISO(iso).toMillis(),
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('TaskModel.create: saves the task before enqueuing it', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const order = [];
    Sinon.stub(TaskSchema.prototype, 'save').callsFake(async function () {
      order.push('save');
      return this;
    });
    Sinon.stub(SQS.SQSClient.prototype, 'send').callsFake(async () => {
      order.push('send');
      return {};
    });

    await TaskModel.create(makeInput({ filters: {} }), context);

    t.deepEquals(
      order,
      ['save', 'send'],
      'The handler must be able to read the doc when it picks up the message',
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
