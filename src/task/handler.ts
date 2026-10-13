import { type SQSBatchResponse, type SQSEvent, type SQSRecord } from 'aws-lambda';
import { getConfig, type Config } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import { TaskModel } from '../api/db/models/Task.js';
import GetStats from './stats.js';
import { CreateDeployment, UpdateDeployment, DeleteDeployment } from './deployment.js';
import { DeleteCamera, UpdateSerialNumber } from './camera.js';
import ImageErrorExport from './image-errors.js';
import AnnotationsExport from './annotations.js';
import { parseConfig } from './utils.js';
import { type TaskInput } from '../api/db/models/Task.js';
import GraphQLError, { InternalServerError } from '../api/errors.js';
import { type User } from '../api/auth/authorization.js';
import {
  DeleteImages,
  DeleteImagesByFilter,
  SetTimestampOffsetBatch,
  SetTimestampOffsetByFilter,
} from './image.js';
import { DeleteProjectLabel } from './project.js';

async function runTask(task: TaskInput<any> & { _id: string }, config: Config) {
  if (task.type === 'GetStats') {
    return await GetStats(task);
  } else if (task.type === 'ExportAnnotations') {
    return await AnnotationsExport(task, config);
  } else if (task.type === 'ExportImageErrors') {
    return await ImageErrorExport(task, config);
  } else if (task.type === 'CreateDeployment') {
    return await CreateDeployment(task);
  } else if (task.type === 'UpdateDeployment') {
    return await UpdateDeployment(task);
  } else if (task.type === 'DeleteDeployment') {
    return await DeleteDeployment(task);
  } else if (task.type === 'UpdateSerialNumber') {
    return await UpdateSerialNumber(task);
  } else if (task.type === 'DeleteImages') {
    return await DeleteImages(task);
  } else if (task.type === 'DeleteImagesByFilter') {
    return await DeleteImagesByFilter(task);
  } else if (task.type === 'SetTimestampOffsetBatch') {
    return await SetTimestampOffsetBatch(task);
  } else if (task.type === 'SetTimestampOffsetByFilter') {
    return await SetTimestampOffsetByFilter(task);
  } else if (task.type === 'DeleteCamera') {
    return await DeleteCamera(task);
  } else if (task.type === 'DeleteProjectLabel') {
    return await DeleteProjectLabel(task, config);
  } else {
    throw new Error(`Unknown Task: ${JSON.stringify(task)}`);
  }
}

async function processRecord(record: SQSRecord, config: Config) {
  const body = JSON.parse(record.body);
  const user = { curr_project: body.projectId } as User;
  const taskDoc = await TaskModel.queryById(body._id, { user });

  if (taskDoc.status === 'COMPLETE' || taskDoc.status === 'FAIL') {
    console.log(`Task ${body._id} is already ${taskDoc.status}; skipping redelivered message`);
    return;
  }

  // A RUNNING Task on a redelivery means the previous attempt died mid-flight - almost always a
  // Lambda timeout. Without checkpointing there is nothing to resume from, so retrying would just
  // burn another full timeout window.
  const receiveCount = Number(record.attributes.ApproximateReceiveCount ?? '1');
  if (taskDoc.status === 'RUNNING' && receiveCount > 1) {
    await TaskModel.update(
      {
        _id: body._id,
        status: 'FAIL',
        output: {
          error: new InternalServerError(
            'Task did not complete within the maximum allowed execution time',
          ),
        },
      },
      { user },
    );
    return;
  }

  await TaskModel.update({ _id: body._id, status: 'RUNNING', heartbeat: new Date() }, { user });

  const task: TaskInput<any> & { _id: string } = {
    _id: taskDoc._id.toString(),
    user: taskDoc.user,
    projectId: taskDoc.projectId,
    type: taskDoc.type,
    config: parseConfig(taskDoc.toObject().config ?? {}),
  };

  try {
    const output = await runTask(task, config);
    await TaskModel.update({ _id: task._id, status: 'COMPLETE', output }, { user });
  } catch (err) {
    await TaskModel.update(
      {
        _id: task._id,
        status: 'FAIL',
        output: {
          error: err instanceof GraphQLError ? err : new InternalServerError(err as string),
        },
      },
      { user },
    );
  }
}

async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];
  if (!event.Records || !event.Records.length) return { batchItemFailures };

  const config = await getConfig();
  await connectToDatabase(config);

  for (const record of event.Records) {
    try {
      await processRecord(record, config);
    } catch (err) {
      // We couldn't even record the failure on the Task, so let SQS redeliver it.
      console.error('Unrecoverable error processing task message: ', err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
}

export { handler };
