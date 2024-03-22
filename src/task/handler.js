import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { TaskModel } from '../api/db/models/Task.js';
import GetStats from './stats.js';
import { parseMessage } from './utils.js';

async function handler(event) {
  if (!event.Records || !event.Records.length) return;
  const config = await getConfig();
  await connectToDatabase(config);

  for (const record of event.Records) {
    console.log(`record body: ${record.body}`);
    const task = parseMessage(JSON.parse(record.body));

    let output = {};
    await TaskModel.update(
      { _id: task._id, status: 'RUNNING' },
      { user: { curr_project: task.projectId } }
    );

    try {
      if (task.type === 'GetStats') {
        output = await GetStats(task);
      } else {
        throw new Error(`Unknown Task: ${task}`);
      }

      await TaskModel.update(
        { _id: task._id, status: 'COMPLETE', output },
        { user: { curr_project: task.projectId } }
      );

    } catch (err) {
      await TaskModel.update(
        { _id: task._id, status: 'FAIL', output: { error: err } },
        { user: { curr_project: task.projectId } }
      );
    }
  }

  return true;
}

export { handler };
