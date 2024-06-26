import tape from 'tape';
import fs from 'node:fs';
import { MockAgent, setGlobalDispatcher } from 'undici';
import path from 'node:path';
import Sinon from 'sinon';
import SM from '@aws-sdk/client-sagemaker-runtime';

import { modelInterfaces } from '../.build/ml/modelInterfaces.js';

const base = new URL(path.parse(import.meta.url).dir).pathname;

process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('ML-Inference Megadetector', async (t) => {
  const mockAgent = new MockAgent();
  setGlobalDispatcher(mockAgent);

  const mockPool = mockAgent.get('http://example.com');

  mockPool.intercept({
    path: '/original/1-original.png',
    method: 'GET'
  }).reply(200, fs.readFileSync(path.resolve(base, './fixtures/cat.jpg')));

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
  const mockAgent = new MockAgent();
  setGlobalDispatcher(mockAgent);

  const mockPool = mockAgent.get('http://example.com');

  mockPool.intercept({
    path: '/original/1-original.png',
    method: 'GET'
  }).reply(200, fs.readFileSync(path.resolve(base, './fixtures/cat.jpg')));

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
