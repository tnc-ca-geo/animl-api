import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import Task from '../api/db/schemas/Task.js';
import { InternalServerError } from '../api/errors.js';

// A RUNNING Task heartbeats when it starts, so this must exceed the task Lambda's 900s timeout.
const RUNNING_TASK_TIMEOUT_MINUTES = 20;
// SUBMITTED Tasks can legitimately sit in the queue behind others, so give them a wider window.
const SUBMITTED_TASK_TIMEOUT_MINUTES = 60;

function staleFilter(status: string, minutes: number) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return {
    status,
    $or: [
      { heartbeat: { $lt: cutoff } },
      // Tasks created before `heartbeat` existed.
      { heartbeat: { $exists: false }, updated: { $lt: cutoff } },
    ],
  };
}

/**
 * Scheduled Lambda handler that fails Tasks which died mid-flight. A Lambda timeout kills the task
 * handler before it can mark the Task FAIL, which would otherwise leave it RUNNING forever while
 * the frontend polls it indefinitely.
 *
 * Triggered by EventBridge cron rule.
 */
export async function sweepStaleTasks(): Promise<void> {
  const config = await getConfig();
  await connectToDatabase(config);

  const now = new Date();
  const res = await Task.updateMany(
    {
      $or: [
        staleFilter('RUNNING', RUNNING_TASK_TIMEOUT_MINUTES),
        staleFilter('SUBMITTED', SUBMITTED_TASK_TIMEOUT_MINUTES),
      ],
    },
    {
      $set: {
        status: 'FAIL',
        updated: now,
        heartbeat: now,
        output: {
          error: new InternalServerError('Task stopped responding and was marked as failed'),
        },
      },
    },
  );

  console.log(`sweepStaleTasks: failed ${res.modifiedCount} stale task(s)`);
}
