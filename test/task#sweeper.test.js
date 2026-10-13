import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import TaskSchema from '../.build/api/db/schemas/Task.js';
import { sweepStaleTasks } from '../.build/task/sweeper.js';

const MINUTE = 60 * 1000;

// Captures the filter/update passed to Task.updateMany
const stubUpdateMany = (modifiedCount = 0) => {
  const calls = [];
  Sinon.stub(TaskSchema, 'updateMany').callsFake(async (filter, update) => {
    calls.push({ filter, update });
    return { modifiedCount };
  });
  return calls;
};

const branchFor = (filter, status) => filter.$or.find((b) => b.status === status);

tape('Task sweeper: only targets SUBMITTED and RUNNING tasks', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const calls = stubUpdateMany();
    await sweepStaleTasks();

    t.equal(calls.length, 1, 'Should issue a single updateMany');

    const statuses = calls[0].filter.$or.map((b) => b.status).sort();
    t.deepEquals(statuses, ['RUNNING', 'SUBMITTED'], 'Should never touch COMPLETE or FAIL tasks');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Task sweeper: uses a 20 minute cutoff for RUNNING tasks', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const calls = stubUpdateMany();
    const before = Date.now();
    await sweepStaleTasks();
    const after = Date.now();

    const cutoff = branchFor(calls[0].filter, 'RUNNING').$or[0].heartbeat.$lt;
    t.ok(cutoff instanceof Date, 'Cutoff should be a Date');
    t.ok(
      cutoff.getTime() >= before - 20 * MINUTE && cutoff.getTime() <= after - 20 * MINUTE,
      'RUNNING cutoff should be ~20 minutes ago, which exceeds the 900s Lambda timeout',
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Task sweeper: uses a wider 60 minute cutoff for SUBMITTED tasks', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const calls = stubUpdateMany();
    const before = Date.now();
    await sweepStaleTasks();
    const after = Date.now();

    const cutoff = branchFor(calls[0].filter, 'SUBMITTED').$or[0].heartbeat.$lt;
    t.ok(
      cutoff.getTime() >= before - 60 * MINUTE && cutoff.getTime() <= after - 60 * MINUTE,
      'SUBMITTED tasks can queue behind others, so they get a wider window',
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape(
  'Task sweeper: falls back to `updated` for tasks created before heartbeat existed',
  async (t) => {
    try {
      Sinon.restore();
      MockConfig(t);

      const calls = stubUpdateMany();
      await sweepStaleTasks();

      for (const status of ['RUNNING', 'SUBMITTED']) {
        const branch = branchFor(calls[0].filter, status);
        t.equal(branch.$or.length, 2, `${status} should have a heartbeat and a legacy branch`);

        const legacy = branch.$or[1];
        t.deepEquals(
          legacy.heartbeat,
          { $exists: false },
          `${status} legacy branch checks heartbeat`,
        );
        t.ok(legacy.updated.$lt instanceof Date, `${status} legacy branch falls back to updated`);
        t.equal(
          legacy.updated.$lt.getTime(),
          branch.$or[0].heartbeat.$lt.getTime(),
          `${status} should use the same cutoff for both branches`,
        );
      }
    } catch (err) {
      t.error(err);
    }

    Sinon.restore();
    t.end();
  },
);

tape('Task sweeper: marks stale tasks FAIL with an error and a fresh heartbeat', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const calls = stubUpdateMany(3);
    await sweepStaleTasks();

    const { $set } = calls[0].update;
    t.equal($set.status, 'FAIL');
    t.ok(
      $set.error === undefined,
      'Error should be nested under output, where the frontend reads it',
    );
    t.ok($set.output.error, 'Should record an error the frontend can surface');
    t.ok(/stopped responding/.test($set.output.error.message));
    t.ok($set.updated instanceof Date, 'Should bump updated');
    t.ok($set.heartbeat instanceof Date, 'Should bump heartbeat so it is not swept repeatedly');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
