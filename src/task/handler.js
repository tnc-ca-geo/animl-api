import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { TaskModel } from '../api/db/models/Task.js';
import GetStats from './stats.js';
import ImageErrorExport from './image-errors.js';
import ImageExport from './images.js';
import { parseMessage } from './utils.js';
import GraphQLError, { InternalServerError } from '../api/errors.js';

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
      } else if (task.type === 'AnnotationsExport') {
        output = await ImageExport(task, config);
      } else if (task.type === 'ImageErrorsExport') {
        output = await ImageErrorExport(task, config);
      } else {
        throw new Error(`Unknown Task: ${task}`);
      }

      await TaskModel.update(
        { _id: task._id, status: 'COMPLETE', output },
        { user: { curr_project: task.projectId } }
      );

    } catch (err) {
      await TaskModel.update(
        { _id: task._id, status: 'FAIL', output: { error: err instanceof GraphQLError ? err : new InternalServerError(err) } },
        { user: { curr_project: task.projectId } }
      );
    }
  }

  return true;
}

export { handler };
