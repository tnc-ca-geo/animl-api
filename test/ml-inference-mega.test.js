import tape from 'tape';
import fs from 'node:fs';
import path from 'node:path';
import Sinon from 'sinon';
import SM from '@aws-sdk/client-sagemaker-runtime';
import S3 from '@aws-sdk/client-s3';

import { modelInterfaces } from '../.build/ml/modelInterfaces.js';

const base = new URL(path.parse(import.meta.url).dir).pathname;

process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('ML-Inference Megadetector', async (t) => {
  // Mock S3 client instead of HTTP requests
  Sinon.stub(S3.S3Client.prototype, 'send').callsFake((command) => {
    if (command instanceof S3.GetObjectCommand) {
      t.equals(command.input.Bucket, 'test-bucket');
      t.equals(command.input.Key, 'original/1-original.png');
      return Promise.resolve({
        Body: {
          transformToByteArray: () => Promise.resolve(fs.readFileSync(path.resolve(base, './fixtures/cat.jpg')))
        }
      });
    } else {
      throw new Error('Unknown S3 Command');
    }
  });

  Sinon.stub(SM.SageMakerRuntimeClient.prototype, 'send').callsFake((command) => {
    if (command instanceof SM.InvokeEndpointCommand) {
      t.ok(command.input.Body instanceof Buffer);
      t.equals(command.input.EndpointName, 'http://sagemaker-realtime-dev-endpoint.amazon.com');

      return Promise.resolve({
        Body: Buffer.from(JSON.stringify([{
          x1: 0.45518332719802856,
          y1: 0.28664860129356384,
          x2: 0.6615734100341797,
          y2: 0.5675788521766663,
          confidence: 0.9314358830451965,
          class: 1
        }]))
      });
    } else {
      throw new Error('Unknown Command');
    }
  });

  try {
    const inference = await modelInterfaces.get('megadetector_v5a')({
      modelSource: {
        _id: 'megadetector_v5a',
        version: 'v5.0a'
      },
      catConfig: [{
        _id: 1,
        name: 'animal',
        disabled: false,
        confThreshold: 0.8
      },{
        _id: 2,
        name: 'person',
        disabled: false,
        confThreshold: 0.5
      },{
        _id: 3,
        name: 'vehicle',
        disabled: true,
        confThreshold: 0.8
      }],
      image: {
        _id: 1,
        fileTypeExtension: 'png'
      },
      config: {
        IMAGES_BUCKET: 'test-bucket',
        '/IMAGES/URL': 'example.com',
        '/ML/MEGADETECTOR_V5A_REALTIME_ENDPOINT': 'http://sagemaker-realtime-dev-endpoint.amazon.com'
      }
    });

    t.deepEquals(inference, [{
      mlModel: 'megadetector_v5a',
      mlModelVersion: 'v5.0a',
      bbox: [0.28664860129356384, 0.45518332719802856, 0.5675788521766663, 0.6615734100341797],
      conf: 0.9314358830451965,
      labelId: 1
    }]);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('ML-Inference Megadetector - Batch Image', async (t) => {
  // Mock S3 client instead of HTTP requests
  Sinon.stub(S3.S3Client.prototype, 'send').callsFake((command) => {
    if (command instanceof S3.GetObjectCommand) {
      t.equals(command.input.Bucket, 'test-bucket');
      t.equals(command.input.Key, 'original/1-original.png');
      return Promise.resolve({
        Body: {
          transformToByteArray: () => Promise.resolve(fs.readFileSync(path.resolve(base, './fixtures/cat.jpg')))
        }
      });
    } else {
      throw new Error('Unknown S3 Command');
    }
  });

  Sinon.stub(SM.SageMakerRuntimeClient.prototype, 'send').callsFake((command) => {
    if (command instanceof SM.InvokeEndpointCommand) {
      t.ok(command.input.Body instanceof Buffer);
      t.equals(command.input.EndpointName, 'http://sagemaker-batch-dev-endpoint.amazon.com');

      return Promise.resolve({
        Body: Buffer.from(JSON.stringify([{
          x1: 0.45518332719802856,
          y1: 0.28664860129356384,
          x2: 0.6615734100341797,
          y2: 0.5675788521766663,
          confidence: 0.9314358830451965,
          class: 1
        }]))
      });
    } else {
      throw new Error('Unknown Command');
    }
  });

  try {
    const inference = await modelInterfaces.get('megadetector_v5a')({
      modelSource: {
        _id: 'megadetector_v5a',
        version: 'v5.0a'
      },
      catConfig: [{
        _id: 1,
        name: 'animal',
        disabled: false,
        confThreshold: 0.8
      },{
        _id: 2,
        name: 'person',
        disabled: false,
        confThreshold: 0.5
      },{
        _id: 3,
        name: 'vehicle',
        disabled: true,
        confThreshold: 0.8
      }],
      image: {
        _id: 1,
        fileTypeExtension: 'png',
        batchId: 1
      },
      config: {
        IMAGES_BUCKET: 'test-bucket',
        '/IMAGES/URL': 'example.com',
        '/ML/MEGADETECTOR_V5A_BATCH_ENDPOINT': 'http://sagemaker-batch-dev-endpoint.amazon.com'
      }
    });

    t.deepEquals(inference, [{
      mlModel: 'megadetector_v5a',
      mlModelVersion: 'v5.0a',
      bbox: [0.28664860129356384, 0.45518332719802856, 0.5675788521766663, 0.6615734100341797],
      conf: 0.9314358830451965,
      labelId: 1
    }]);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
