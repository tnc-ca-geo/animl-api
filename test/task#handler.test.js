import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import { TaskModel } from '../.build/api/db/models/Task.js';
import { CameraModel } from '../.build/api/db/models/Camera.js';
import { handler } from '../.build/task/handler.js';

const DOC_CONFIG = { cameraId: 'cam-a', newSerialNumber: 'cam-b' };

const makeRecord = (body, receiveCount = 1) => ({
  messageId: 'msg-1',
  body: JSON.stringify(body),
  attributes: { ApproximateReceiveCount: String(receiveCount) },
});

const makeTaskDoc = (overrides = {}) => {
  const doc = {
    _id: 'task1',
    user: 'user@example.com',
    projectId: 'project',
    type: 'UpdateSerialNumber',
    status: 'SUBMITTED',
    config: DOC_CONFIG,
    ...overrides,
  };
  return { ...doc, toObject: () => doc };
};

// Returns the recorded TaskModel.update calls so tests can assert status transitions
const stubTask = (t, taskDoc) => {
  const updates = [];
  Sinon.stub(TaskModel, 'queryById').callsFake(async () => taskDoc);
  Sinon.stub(TaskModel, 'update').callsFake(async (input) => {
    updates.push(input);
    return taskDoc;
  });
  return updates;
};

tape('Task handler: marks a successful task COMPLETE', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const updates = stubTask(t, makeTaskDoc());
    let receivedConfig = null;
    Sinon.stub(CameraModel, 'updateSerialNumber').callsFake(async (config) => {
      receivedConfig = config;
      return { isOk: true };
    });

    const res = await handler({
      Records: [makeRecord({ _id: 'task1', projectId: 'project' })],
    });

    t.deepEquals(res.batchItemFailures, [], 'Should report no batch item failures');
    t.equal(updates.length, 2, 'Should update the task twice');
    t.equal(updates[0].status, 'RUNNING');
    t.ok(updates[0].heartbeat instanceof Date, 'Should set a heartbeat when starting');
    t.equal(updates[1].status, 'COMPLETE');
    t.deepEquals(updates[1].output, { isOk: true });
    t.deepEquals(receivedConfig, DOC_CONFIG, 'Should pass the config stored on the Task doc');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Task handler: marks a throwing task FAIL without requeuing it', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const updates = stubTask(t, makeTaskDoc());
    Sinon.stub(CameraModel, 'updateSerialNumber').callsFake(async () => {
      throw new Error('boom');
    });

    const res = await handler({
      Records: [makeRecord({ _id: 'task1', projectId: 'project' })],
    });

    t.deepEquals(res.batchItemFailures, [], 'A handled failure should not be redelivered');
    t.equal(updates.length, 2);
    t.equal(updates[1].status, 'FAIL');
    t.ok(updates[1].output.error, 'Should record the error on the task output');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Task handler: fails an unknown task type', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const updates = stubTask(t, makeTaskDoc({ type: 'NotARealTask' }));

    const res = await handler({
      Records: [makeRecord({ _id: 'task1', projectId: 'project' })],
    });

    t.deepEquals(res.batchItemFailures, []);
    t.equal(updates[1].status, 'FAIL');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

for (const status of ['COMPLETE', 'FAIL']) {
  tape(`Task handler: skips a redelivered message for a ${status} task`, async (t) => {
    try {
      Sinon.restore();
      MockConfig(t);

      const updates = stubTask(t, makeTaskDoc({ status }));
      const taskFn = Sinon.stub(CameraModel, 'updateSerialNumber').callsFake(async () => ({
        isOk: true,
      }));

      const res = await handler({
        Records: [makeRecord({ _id: 'task1', projectId: 'project' }, 2)],
      });

      t.deepEquals(res.batchItemFailures, [], 'Should not redeliver a finished task');
      t.equal(updates.length, 0, 'Should not touch a finished task');
      t.equal(taskFn.callCount, 0, 'Should not re-run a finished task');
    } catch (err) {
      t.error(err);
    }

    Sinon.restore();
    t.end();
  });
}

tape('Task handler: fails a RUNNING task on redelivery instead of re-running it', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const updates = stubTask(t, makeTaskDoc({ status: 'RUNNING' }));
    const taskFn = Sinon.stub(CameraModel, 'updateSerialNumber').callsFake(async () => ({
      isOk: true,
    }));

    const res = await handler({
      Records: [makeRecord({ _id: 'task1', projectId: 'project' }, 2)],
    });

    t.deepEquals(res.batchItemFailures, []);
    t.equal(updates.length, 1, 'Should go straight to FAIL');
    t.equal(updates[0].status, 'FAIL');
    t.ok(
      /execution time/.test(updates[0].output.error.message),
      'Should explain that the task timed out',
    );
    t.equal(taskFn.callCount, 0, 'Should not burn another timeout window');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Task handler: runs a RUNNING task on first delivery', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const updates = stubTask(t, makeTaskDoc({ status: 'RUNNING' }));
    const taskFn = Sinon.stub(CameraModel, 'updateSerialNumber').callsFake(async () => ({
      isOk: true,
    }));

    await handler({ Records: [makeRecord({ _id: 'task1', projectId: 'project' }, 1)] });

    t.equal(taskFn.callCount, 1, 'Should run normally when it has not been redelivered');
    t.equal(updates[1].status, 'COMPLETE');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Task handler: reports a batch item failure when the task cannot be loaded', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    Sinon.stub(TaskModel, 'queryById').callsFake(async () => {
      throw new Error('Task not found');
    });

    const res = await handler({
      Records: [makeRecord({ _id: 'task1', projectId: 'project' })],
    });

    t.deepEquals(
      res.batchItemFailures,
      [{ itemIdentifier: 'msg-1' }],
      'Should let SQS redeliver when we cannot record the failure',
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape(
  'Task handler: falls back to the message body for tasks enqueued before config was persisted',
  async (t) => {
    try {
      Sinon.restore();
      MockConfig(t);

      const legacyConfig = { cameraId: 'legacy-a', newSerialNumber: 'legacy-b' };
      stubTask(t, makeTaskDoc({ config: undefined }));
      let receivedConfig = null;
      Sinon.stub(CameraModel, 'updateSerialNumber').callsFake(async (config) => {
        receivedConfig = config;
        return { isOk: true };
      });

      await handler({
        Records: [makeRecord({ _id: 'task1', projectId: 'project', config: legacyConfig })],
      });

      t.deepEquals(receivedConfig, legacyConfig, 'Should use the config from the SQS body');
    } catch (err) {
      t.error(err);
    }

    Sinon.restore();
    t.end();
  },
);

tape('Task handler: prefers the persisted config over the message body', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    stubTask(t, makeTaskDoc());
    let receivedConfig = null;
    Sinon.stub(CameraModel, 'updateSerialNumber').callsFake(async (config) => {
      receivedConfig = config;
      return { isOk: true };
    });

    await handler({
      Records: [
        makeRecord({
          _id: 'task1',
          projectId: 'project',
          config: { cameraId: 'stale', newSerialNumber: 'stale' },
        }),
      ],
    });

    t.deepEquals(receivedConfig, DOC_CONFIG, 'Should ignore a stale config in the SQS body');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Task handler: no-ops on an empty event', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const res = await handler({ Records: [] });
    t.deepEquals(res.batchItemFailures, []);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
