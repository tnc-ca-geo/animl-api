const tape = require('tape');
const nock = require('nock');
const path = require('path');
const { runInference } = require('../src/ml/inference.js');

process.env.REGION = 'us-east-1';

tape('ML-Inference Megadetector', async (t) => {
    const scope = nock('http://example.com')
        .get('/original/1-original.png')
        .reply(200, path.resolve(__dirname, './fixtures/cat.jpg'), {
            'Content-Type': 'image/jpeg',
        })

    try {
        await runInference.megadetector({
            modelSource: '',
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

    nock.cleanAll()
    t.end();
});
