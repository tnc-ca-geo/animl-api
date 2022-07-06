const tape = require('tape');
const nock = require('nock');
const path = require('path');
const AWS = require('@mapbox/mock-aws-sdk-js');

const { runInference } = require('../src/ml/inference.js');

process.env.REGION = 'us-east-1';

tape('ML-Inference Megadetector', async (t) => {
    const scope = nock('http://example.com')
        .get('/original/1-original.png')
        .reply(200, path.resolve(__dirname, './fixtures/cat.jpg'), {
            'Content-Type': 'image/jpeg',
        })

    AWS.stub('SageMakerRuntime', 'invokeEndpoint', async function(params) {
        t.ok(params.Body instanceof Buffer)

        return this.request.promise.returns(Promise.resolve({
            Body: [{
                x1: 0.45518332719802856,
                y1: 0.28664860129356384,
                x2: 0.6615734100341797,
                y2: 0.5675788521766663,
                confidence: 0.9314358830451965,
                class: 0
            }]
        }));
    });

    try {
        await runInference.megadetector({
            modelSource: {
                _id: 1,
                version: 2
            },
            catConfig: '',
            image: {
                _id: 1,
                fileTypeExtension: 'png'
            },
            label: '',
            config: {
                '/IMAGES/URL': 'http://example.com',
                '/ML/MEGADETECTOR_API_URL': 'http://example.com'
            }
        });
    } catch (err) {
        t.error(err);
    }

    AWS.SageMakerRuntime.restore();
    nock.cleanAll()
    t.end();
});
