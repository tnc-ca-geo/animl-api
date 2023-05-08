const tape = require('tape');
const nock = require('nock');
const path = require('path');
const Sinon = require('sinon');
const SM = require('@aws-sdk/client-sagemaker-runtime');

const { modelInterfaces } = require('../src/ml/modelInterfaces.js');

process.env.REGION = 'us-east-1';

tape('ML-Inference Megadetector', async (t) => {
  nock('http://example.com')
    .get('/original/1-original.png')
    .reply(200, path.resolve(__dirname, './fixtures/cat.jpg'), {
      'Content-Type': 'image/jpeg'
    });

  Sinon.stub(SM.SageMakerRuntimeClient.prototype, 'send').callsFake((command) => {
    if (command instanceof SM.InvokeEndpointCommand) {
      t.ok(command.input.Body instanceof Buffer);

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
    const inference = await modelInterfaces.get('megadetector')({
      modelSource: {
        _id: 1,
        version: 2
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
        '/IMAGES/URL': 'http://example.com',
        '/ML/MEGADETECTOR_SAGEMAKER_NAME': 'http://example.com'
      }
    });

    t.deepEquals(inference, [{
      mlModel: 1,
      mlModelVersion: 2,
      type: 'ml',
      bbox: [0.28664860129356384, 0.45518332719802856, 0.5675788521766663, 0.6615734100341797],
      conf: 0.9314358830451965,
      category: 'animal'
    }]);
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  nock.cleanAll();
  t.end();
});
