import { type SQSEvent } from 'aws-lambda';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { TaskModel } from '../api/db/models/Task.js';
import GetStats from './stats.js';
import { CreateDeployment, UpdateDeployment, DeleteDeployment } from './deployment.js';
import { UpdateSerialNumber } from './camera.js';
import ImageErrorExport from './image-errors.js';
import AnnotationsExport from './annotations.js';
import { parseMessage } from './utils.js';
import { type TaskInput } from '../api/db/models/Task.js';
import GraphQLError, { InternalServerError } from '../api/errors.js';
import { type User } from '../api/auth/authorization.js';
import { DeleteImages, DeleteImagesByFilter } from './image.js';

async function handler(event: SQSEvent) {
  if (!event.Records || !event.Records.length) return;
  const config = await getConfig();
  await connectToDatabase(config);

  for (const record of event.Records) {
    console.log(`record body: ${record.body}`);
    const task: TaskInput<any> & { _id: string } = parseMessage(JSON.parse(record.body));

    let output: Record<any, any> | undefined = {};
    await TaskModel.update(
      { _id: task._id, status: 'RUNNING' },
      { user: { curr_project: task.projectId } as User },
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
      } else if (task.type === 'UpdateSerialNumber') {
        output = await UpdateSerialNumber(task);
      } else if (task.type === 'DeleteImages') {
        output = await DeleteImages(task);
      } else if (task.type === 'DeleteImagesByFilter') {
        output = await DeleteImagesByFilter(task);
      } else {
        throw new Error(`Unknown Task: ${JSON.stringify(task)}`);
      }

      await TaskModel.update(
        { _id: task._id, status: 'COMPLETE', output },
        { user: { curr_project: task.projectId } as User },
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
        { user: { curr_project: task.projectId } as User },
      );
    }
  }

  return true;
}

export { handler };
