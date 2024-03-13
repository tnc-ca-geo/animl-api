import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { TaskModel } from '../api/db/models/Task.js';

async function handler(event) {
  if (!event.Records || !event.Records.length) return;
  const config = await getConfig();
  await connectToDatabase(config);

  for (const record of event.Records) {
    console.log(`record body: ${record.body}`);
    const params = JSON.parse(record.body);

    try {
      if (params.type === 'STATS') {
        console.error('STATS');
      } else {
        throw new Error(`Unknown Task: ${params}`);
      }
    } catch (err) {
      await TaskModel.update({
        _id: params._id,
        status: 'FAIl',
        output: { error: err.message }
      });
    }
  }

  return true;
}

export { handler };
