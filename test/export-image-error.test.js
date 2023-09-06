import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import S3 from '@aws-sdk/client-s3';
import { ImageError } from '../src/api/db/schemas/ImageError.js';
import Signer from '../src/export/signer.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

import { handler } from '../src/export/handler.js';

tape('Export: Image-Errors - Empty Event', async (t) => {
  try {
    const res = await handler({
      Records: []
    });

    t.equals(res, undefined);
  } catch (err) {
    t.error(err);
  }

  t.end();
});

tape('Export: Image-Errors - Basic Event', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    let s3count = 0;
    Sinon.stub(S3.S3Client.prototype, 'send').callsFake((command) => {
      ++s3count;
      if (command instanceof S3.PutObjectCommand) {
        mocks.push('S3::PutObjectCommand');
        if (command.input.Key === '123.json' && s3count < 1) {
          t.deepEquals(command.input, {
            Bucket: 'example-bucket',
            Key: '123.json',
            Body: '{"status":"Success","error":[],"count":1,"meta":{}}',
            ContentType: 'application/json; charset=utf-8'
          });
        } else if (command.input.Key === '123.json') {
          t.deepEquals(command.input, {
            Bucket: 'example-bucket',
            Key: '123.json',
            Body: '{"status":"Success","error":[],"url":"https://example-signed-url.com?fake=params","count":1,"meta":{}}',
            ContentType: 'application/json; charset=utf-8'
          });
        } else {
          const body = String(command.input.Body).split('\n');
          delete command.input.Body;

          t.ok(body.length, 2);
          t.deepEquals(body[0].split(','), ['_id', 'created', 'image', 'batch', 'path', 'error']);
          t.deepEquals(body[1], '123,"Jan 1, 2022, 12:00:00 AM",image-123,batch-123,input.jpg,This is an Error');
        }
      } else {
        t.fail();
      }
    });

    const aggres = [{
      input: [
        { $match: { batch: 'batch-123' } },
        { $count: 'count' }
      ],
      output: Promise.resolve([{ count: 1 }])
    },{
      input: [
        { $match: { batch: 'batch-123' } }
      ],
      output: (async function* () {
        yield {
          _id: '123',
          created: new Date('2022-01-01T00:00:00Z'),
          image: 'image-123',
          batch: 'batch-123',
          path: 'input.jpg',
          error: 'This is an Error'
        };
      })()
    }];

    Sinon.stub(ImageError, 'aggregate').callsFake((command) => {
      mocks.push('ImageError::Aggregate');
      const curr = aggres.splice(0, 1)[0];
      t.deepEquals(command, curr.input);
      return curr.output;
    });

    Sinon.stub(Signer, 'getSignedUrl').callsFake(() => {
      mocks.push('Signer::getSignedUrl');
      return Promise.resolve('https://example-signed-url.com?fake=params');
    });

    const res = await handler({
      Records: [{
        body: JSON.stringify({
          type: 'ImageErrors',
          documentId: '123',
          filters: {
            batch: 'batch-123'
          },
          format: 'csv'
        })
      }]
    });

    t.equals(res, true);
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, [
    'ImageError::Aggregate',
    'ImageError::Aggregate',
    'S3::PutObjectCommand',
    'Signer::getSignedUrl',
    'S3::PutObjectCommand'
  ]);

  Sinon.restore();
  t.end();
});
