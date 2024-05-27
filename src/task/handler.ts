import { SQSEvent } from 'aws-lambda';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { TaskModel } from '../api/db/models/Task.js';
import GetStats from './stats.js';
import { CreateDeployment, UpdateDeployment, DeleteDeployment } from './deployment.js';
import ImageErrorExport from './image-errors.js';
import AnnotationsExport from './annotations.js';
import { parseMessage } from './utils.js';
import { TaskInput } from '../api/db/models/Task.js';
import GraphQLError, { InternalServerError } from '../api/errors.js';
import { WithId } from '../api/db/models/utils.js';

async function handler(event: SQSEvent) {
  if (!event.Records || !event.Records.length) return;
  const config = await getConfig();
  await connectToDatabase(config);

  for (const record of event.Records) {
    console.log(`record body: ${record.body}`);
    const task: WithId<TaskInput<any>> = parseMessage(JSON.parse(record.body));

    let output: Record<any, any> | undefined = {};
    await TaskModel.update(
      { _id: task._id, status: 'RUNNING' },
      { user: { curr_project: task.projectId } },
    );

    try {
      if (task.type === 'GetStats') {
        output = await GetStats(task);
      } else if (task.type === 'ExportAnnotations') {
        output = await AnnotationsExport(task, config);
      } else if (task.type === 'ExportImageErrors') {
        output = await ImageErrorExport(task, config);
      } else if (task.type === 'CreateDeployment') {
        output = await CreateDeployment(task);
      } else if (task.type === 'UpdateDeployment') {
        output = await UpdateDeployment(task);
      } else if (task.type === 'DeleteDeployment') {
        output = await DeleteDeployment(task);
      } else {
        throw new Error(`Unknown Task: ${JSON.stringify(task)}`);
      }

      await TaskModel.update(
        { _id: task._id, status: 'COMPLETE', output },
        { user: { curr_project: task.projectId } },
      );
    } catch (err) {
      await TaskModel.update(
        {
          _id: task._id,
          status: 'FAIL',
          output: {
            error: err instanceof GraphQLError ? err : new InternalServerError(err as string),
          },
        },
        { user: { curr_project: task.projectId } },
      );
    }
  }

  return true;
}

export { handler };
