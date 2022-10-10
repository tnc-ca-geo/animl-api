const stream = require('node:stream/promises');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const { stringify } = require('csv-stringify');
const { getConfig } = require('../config/config');
const { ApolloError } = require('apollo-server-errors');
const { connectToDatabase } = require('../api/db/connect');
const generateImageModel = require('../api/db/models/Image');
const generateProjectModel = require('../api/db/models/Project');
const Image = require('../api/db/schemas/Image');
const { buildFilter, isImageReviewed } = require('../api/db/models/utils');
const utils = require('./utils');

exports.export = async (event) => {
  if (!event.Records || !event.Records.length) return;
  const config = await getConfig();
  await connectToDatabase(config);
  const user = { 'is_superuser': true };
  const models = {
    Project: generateProjectModel({ user }),
    Image: generateImageModel({ user })
  };
  const s3 = new S3Client({ region: process.env.AWS_DEFAULT_REGION });

  for (const record of event.Records) {
    console.log(`record body: ${record.body}`);
    const { projectId, documentId, filters } = JSON.parse(record.body);
    const filename = documentId + '.csv';
    const bucket = config['/EXPORTS/EXPORTED_DATA_BUCKET'];
    let imageCount = 0;
    let reviewed = 0;
    let notReviewed = 0;

    try {
      // get project's cameraConfigs, so we can map deplyment Ids to deployment data
      const [project] = await models.Project.getProjects([projectId]);
      const { categories } = await models.Image.getLabels(projectId);

      // flatten image record transform stream
      const flattenImg = await utils.flattenImgTransform(project, categories);

      // conver objects to CSV string stream
      const columns = config.CSV_EXPORT_COLUMNS.concat(categories);
      const convertToCSV = stringify({ header: true, columns });

      // write to S3 object stream
      const { streamToS3, uploadPromise } = utils.streamToS3(filename, bucket, s3);

      // stream in images from MongoDB, write to transformation stream
      const query = buildFilter(filters, projectId);
      for await (const img of Image.find(query)) {
        imageCount++;
        if (isImageReviewed(img)) {
          reviewed++;
          flattenImg.write(img);
        } else {
          notReviewed++;
        }
      }
      flattenImg.end();

      // pipe together transform and write streams
      await stream.pipeline(
        flattenImg,
        convertToCSV,
        streamToS3
      );

      // wait for upload complete
      const { Bucket, Key } = await uploadPromise;
      console.log('CSV upload complete');


      // get presigned url for new S3 object (expires in one hour)
      const command = new GetObjectCommand({ Bucket, Key });
      const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

      console.log('upading status document in s3');
      // update status document in S3
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${documentId}.json`,
        Body: JSON.stringify({
          status: 'Success',
          url,
          imageCount,
          reviewedCount: { reviewed, notReviewed }
        }),
        ContentType: 'application/json; charset=utf-8'
      }));

    } catch (err) {
      // TODO: add error to S3 object?
      // await status.error(err.message);
      // process.exit(1);

      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  return true;
};
