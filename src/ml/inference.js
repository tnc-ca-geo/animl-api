const agent = require('superagent');
const fs = require('fs');
const { buildImgUrl } = require('../api/db/models/utils');
const AWS = require('aws-sdk');

const runInference = {

  // get image from S3, read in as buffer of binary data
  _getImage: async (image, config) => {
    const url = buildImgUrl(image, config);

    try {
      let img = await agent.get(url).buffer(true);
      return Buffer.from(img.body, 'binary');
    } catch (err) {
      throw new Error(err);
    }
  },

  megadetector: async (params) => {
    const { modelSource, catConfig, image, config } = params;
    const imgBuffer = await runInference._getImage(image, config);

    try {
      const smr = new AWS.SageMakerRuntime({ region: process.env.REGION });

      let detections = (await smr.invokeEndpoint({
        Body: imgBuffer,
        EndpointName: config['/ML/MEGADETECTOR_API_URL']
      }).promise()).Body;

      // Megadetector API returns detections as nested arrays
      // w/ each detection represented as:
      // [ymin, xmin, ymax, xmax, confidence, category].
      // the first four floats are the relative coordinates of the bbox

      const formatedDets = detections.map((det) => ({
        mlModel: modelSource._id,
        mlModelVersion: modelSource.version,
        type: 'ml',
        bbox: [ det.y1, det.x1, det.y2, det.x2 ],
        conf: det.confidence,
        category: catConfig.find((cat) => cat._id === det.class).name,
      }));

      // filter out disabled detections & detections below confThreshold
      let filteredDets = formatedDets.filter((det) => {
        const { disabled, confThreshold } = catConfig.find((cat) => (
          cat.name === det.category
        ));
        return !disabled && det.conf >= confThreshold;
      });

      // add "empty" detection
      if (filteredDets.length === 0) {
        filteredDets.push({
          mlModel: modelSource._id,
          mlModelVersion: modelSource.version,
          type: 'ml',
          bbox: [0, 0, 1, 1],
          category: 'empty',
        });
      }

      return filteredDets;

    } catch (err) {
      throw new Error(err);
    }
  },

  mira: async (params) => {

    const { modelSource, catConfig, image, label, config } = params;
    const imgBuffer = await runInference._getImage(image, config);
    const bbox = label.bbox ? label.bbox : [0,0,1,1];

    try {
      let res = await agent
        .post(config['/ML/MIRA_API_URL'])
        .field('bbox', JSON.stringify(bbox))
        .attach('image', imgBuffer, image._id + '.jpg');
      res = JSON.parse(res.res.text);

      const filteredDets = Object.values(res).reduce((dets, classifier) => {
        // only evaluate top predictions
        const [category, conf] = Object.entries(classifier.predictions)
          .sort((a, b) => b[1] - a[1])[0];

        // filter out disabled detections,
        // empty detections, & detections below confThreshold
        // NOTE: we disregard "empty" class detections from MIRA classifiers
        // b/c we're using Megadetector to determine if objects are present
        const { disabled, confThreshold } = catConfig.find((cat) => (
          cat.name === category
        ));
        if (!disabled && category !== 'empty' && conf >= confThreshold) {
          dets.push({
            mlModel: modelSource._id,
            mlModelVersion: modelSource.version,
            type: 'ml',
            bbox,
            conf,
            category
          });
        }

        return dets;
      }, []);

      return filteredDets;

    } catch (err) {
      throw new Error(err);
    }

  },
}

module.exports = {
  runInference,
};
