const stream = require('node:stream/promises');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { stringify } = require('csv-stringify');
const { getConfig } = require('../config/config');
const { connectToDatabase } = require('../api/db/connect');
const generateImageModel = require('../api/db/models/Image');
const generateProjectModel = require('../api/db/models/Project');
const Image = require('../api/db/schemas/Image');
const { buildFilter, isImageReviewed } = require('../api/db/models/utils');
const utils = require('./utils');
const { ApolloError } = require('apollo-server-lambda');

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
    const { projectId, documentId, filters, format } = JSON.parse(record.body);
    const ext = format === 'coco' ? '.json' : '.csv';
    const filename = documentId + ext;
    const bucket = config['/EXPORTS/EXPORTED_DATA_BUCKET'];
    let imageCount = 0;
    let reviewed = 0;
    let notReviewed = 0;

    try {

      // get project's cameraConfigs, so we can map deployment Ids to deployment data
      const [project] = await models.Project.getProjects([projectId]);
      const { categories } = await models.Image.getLabels(projectId);

      if (format === 'csv') {
        console.log('exporting to csv');

        // flatten image record transform stream
        // TODO: use different transform step for COCO
        const flattenImg = await utils.flattenImgTransform(project, categories);

        // convert objects to CSV string stream
        // TODO: use different conversion step for COCO (JS Object to JSON)
        const columns = config.CSV_EXPORT_COLUMNS.concat(categories);
        const convertToCSV = stringify({ header: true, columns });

        // write to S3 object stream
        const { streamToS3, uploadPromise } = utils.streamToS3(format, filename, bucket, s3);

        // stream in images from MongoDB, write to transformation stream
        const sanitizedFilters = utils.sanitizeFilters(filters);
        const query = buildFilter(sanitizedFilters, projectId);
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
        console.log('upload complete');

        // get presigned url for new S3 object (expires in one hour)
        const command = new GetObjectCommand({ Bucket, Key });
        const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

        console.log('updating status document in s3');
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


      } else if (format === 'coco') {
        console.log('exporting to coco')

      } else {
        console.log('unsupported format: ', format)
        throw new ApolloError();
      }

    } catch (err) {
      console.log('error exporting data: ', err);
      // update status document in S3 with error
      // TODO: make sure the status document exists first
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${documentId}.json`,
        Body: JSON.stringify({
          status: 'Error',
          error: err
        }),
        ContentType: 'application/json; charset=utf-8'
      }));
      process.exit(1);
    }
  }

  return true;
};
