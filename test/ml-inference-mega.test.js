const tape = require('tape');
const fs = require('node:fs');
const { MockAgent, setGlobalDispatcher } = require('undici');
const path = require('path');
const Sinon = require('sinon');
const SM = require('@aws-sdk/client-sagemaker-runtime');

const { modelInterfaces } = require('../src/ml/modelInterfaces.js');

process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('ML-Inference Megadetector', async (t) => {
  const mockAgent = new MockAgent();
  setGlobalDispatcher(mockAgent);

  const mockPool = mockAgent.get('http://example.com');

  mockPool.intercept({
    path: '/original/1-original.png',
    method: 'GET'
  }).reply(200, fs.readFileSync(path.resolve(__dirname, './fixtures/cat.jpg')));

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
      type: 'ml',
      bbox: [0.28664860129356384, 0.45518332719802856, 0.5675788521766663, 0.6615734100341797],
      conf: 0.9314358830451965,
      category: 'animal'
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
  }).reply(200, fs.readFileSync(path.resolve(__dirname, './fixtures/cat.jpg')));

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
      type: 'ml',
      bbox: [0.28664860129356384, 0.45518332719802856, 0.5675788521766663, 0.6615734100341797],
      conf: 0.9314358830451965,
      category: 'animal'
    }]);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
