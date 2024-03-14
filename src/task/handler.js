import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { TaskModel } from '../api/db/models/Task.js';
import GetStats from './stats.js';

async function handler(event) {
  if (!event.Records || !event.Records.length) return;
  const config = await getConfig();
  await connectToDatabase(config);

  for (const record of event.Records) {
    console.log(`record body: ${record.body}`);
    const params = JSON.parse(record.body);

    let output = {};
    await TaskModel.update({ _id: params._id, status: 'RUNNING' });

    try {
      if (params.type === 'GetStats') {
        output = await GetStats(task)
      } else {
        throw new Error(`Unknown Task: ${params}`);
      }

      await TaskModel.update({
        _id: params._id,
        status: 'FAIl',
        output: { error: err.message }
      });

    await TaskModel.update({ _id: params._id, status: 'COMPLETE', output });

    } catch (err) {
      await TaskModel.update({ _id: params._id, status: 'FAIL', output: { error: err.message } });
    }
  }

  return true;
}

export { handler };
