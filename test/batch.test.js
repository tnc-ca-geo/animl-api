import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import SQS from '@aws-sdk/client-sqs';
import { BatchModel } from '../src/api/db/models/Batch.js';
import MongoPaging from 'mongo-cursor-pagination';
import BatchError from '../src/api/db/schemas/BatchError.js';
import ImageError from '../src/api/db/schemas/ImageError.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('Batch#queryByFilter - SQS Response', async (t) => {
  try {
    MockConfig(t);

    Sinon.stub(SQS.SQSClient.prototype, 'send').callsFake((command) => {
      if (command instanceof SQS.GetQueueAttributesCommand) {
        return {
          Attributes: {
            ApproximateNumberOfMessages: 1,
            ApproximateNumberOfMessagesNotVisible: 2
          }
        };
      } else {
        t.fail();
      }
    });

    Sinon.stub(BatchError, 'aggregate').callsFake((command) => {
      t.deepEquals(command, [
        { $match: { batch: 'batch-123' } }
      ]);

      return [];
    });

    Sinon.stub(ImageError, 'aggregate').callsFake((command) => {
      t.deepEquals(command, [
        { $match: { batch: 'batch-123' } },
        { $count: 'count' }
      ]);

      return [{
        count: 321
      }];
    });

    Sinon.stub(MongoPaging, 'aggregate').callsFake((input) => {
      t.deepEquals(input.modelName, 'Batch');

      return {
        batches: [{
          _id: 'batch-123'
        }]
      };
    });
  } catch (err) {
    t.error(err);
  }

  const batches = await BatchModel.queryByFilter({}, {
    user: {
      sub: '123',
      curr_project: 'default-project'
    }
  });

  t.deepEquals(batches, {
    batches: [{
      _id: 'batch-123',
      errors: [],
      imageErrors: 321,
      remaining: 3,
      dead: 3
    }]
  });

  Sinon.restore();
  t.end();
});
