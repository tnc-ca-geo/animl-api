const tape = require('tape');
const { runInference } = require('../src/ml/inference.js');

tape('ML-Inference Megadetector', async (t) => {
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
                '/IMAGES/URL': 'http://example.com'
            }
        });
    } catch (err) {
        t.error(err);
    }

    t.end();
});
