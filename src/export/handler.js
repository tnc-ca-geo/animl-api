const stream = require('node:stream/promises');
const { DateTime } = require('luxon');
const { S3Client, GetObjectCommand, PutObjectCommand, UploadPartCopyCommand, CompleteMultipartUploadCommand } = require('@aws-sdk/client-s3');
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
        const flattenImg = await utils.flattenImgTransform(project, categories);

        // convert objects to CSV string stream
        const columns = config.CSV_EXPORT_COLUMNS.concat(categories);
        const convertToCSV = stringify({ header: true, columns });

        // write to S3 object stream
        const { streamToS3, promise } = utils.streamToS3(format, filename, bucket, s3);

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
        const { Bucket, Key } = await promise;
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
            urls: [url],
            imageCount,
            reviewedCount: { reviewed, notReviewed }
          }),
          ContentType: 'application/json; charset=utf-8'
        }));

      } else if (format === 'coco') {
        console.log('exporting to coco');

        const IMG_COUNT_THRESHOLD = 18000;

        // get image count
        const sanitizedFilters = utils.sanitizeFilters(filters);
        const query = buildFilter(sanitizedFilters, projectId);
        const imgCount = await Image.where(query).countDocuments();
        console.log('imgCount: ', imgCount);
        const multipart = imgCount > IMG_COUNT_THRESHOLD;
        console.log('mulitpart: ', multipart);

        // create categories map
        let catMap = [{ 'name': 'empty' }];
        categories.forEach((cat) => {
          if (cat !== 'empty') catMap.push({ 'name': cat });
        });
        catMap = catMap.map((cat, i) => ({ 'id': i, 'name': cat.name }));
        console.log('catMap: ', catMap);

        const uploads = {
          images: { filename: `${documentId}_images${ext}` },
          annotations: { filename: `${documentId}_annotations${ext}` },
          categories: { filename: `${documentId}_categories${ext}` },
          info: { filename: `${documentId}_info${ext}` }
        };

        uploads.images.upload = utils.streamToS3(format, uploads.images.filename, bucket, s3);
        uploads.annotations.upload = utils.streamToS3(format, uploads.annotations.filename, bucket, s3);
        uploads.categories.upload = { promise: s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: uploads.categories.filename,
          Body: JSON.stringify(catMap, null, 4),
          ContentType: 'application/json; charset=utf-8'
        })) };
        uploads.info.upload = { promise: s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: uploads.info.filename,
          Body: JSON.stringify({
            version : '1.0',
            description : `Image data exported from Animl project '${projectId}'. Export ID: ${documentId}`,
            year : DateTime.now().get('year'),
            date_created: DateTime.now().toISO()
          }, null, 4),
          ContentType: 'application/json; charset=utf-8'
        })) };

        // stream in images from MongoDB, write to transformation stream
        for await (const img of Image.find(query)) {
          imageCount++;
          if (isImageReviewed(img)) {
            reviewed++;
            console.log('img: ', img);
            const imgRecord = utils.createCOCOImg(img);
            uploads.images.upload.streamToS3.write(imgRecord);

            for (const obj of img.objects) {
              const annoRecord = utils.createCOCOAnnotation(obj, img, catMap);
              if (annoRecord) {
                uploads.annotations.upload.streamToS3.write(annoRecord);
              }
            }

          } else {
            notReviewed++;
          }
        }
        uploads.images.upload.streamToS3.end();
        uploads.annotations.upload.streamToS3.end();

        const res = await Promise.allSettled([
          uploads.images.upload.promise,
          uploads.annotations.upload.promise,
          uploads.categories.upload.promise,
          uploads.info.upload.promise
        ]);

        console.log('finished uploading all the files: ', res);

        const urls = [];
        for (const { filename } of Object.values(uploads)) {
          // get presigned url for new S3 object (expires in one hour)
          const command = new GetObjectCommand({ Bucket: bucket, Key: filename });
          const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
          urls.push(url);
        }

        // // TESTING object concatonation via multipart upload copy part

        // // initiate multipart upload
        // const mpObjKey = 'test-concat.json';
        // const initResponse = await utils.initiateMultipartUpload(s3, { Key: mpObjKey, Bucket: bucket });
        // const mpUploadId = initResponse['UploadId'];
        // console.log('multipart upload initiated: ', mpUploadId);

        // const imagesPartParams = {
        //   Bucket: bucket,
        //   Key: mpObjKey,
        //   CopySource: `${bucket}/${uploads.images.filename}`,
        //   PartNumber: 1,
        //   UploadId: mpUploadId
        // };
        // console.log('imagesPartParams: ', imagesPartParams);

        // const annoPartParams = {
        //   Bucket: bucket,
        //   Key: mpObjKey,
        //   CopySource: `${bucket}/${uploads.annotations.filename}`,
        //   PartNumber: 2,
        //   UploadId: mpUploadId
        // };
        // console.log('annoPartParams: ', annoPartParams);

        // // combine the parts
        // const imagesPartRes = await s3.send(new UploadPartCopyCommand(imagesPartParams));
        // const annoPartRes = await s3.send(new UploadPartCopyCommand(annoPartParams));

        // console.log('uploading parts complete - imagesPartRes: ', imagesPartRes);
        // console.log('uploading parts complete - annoPartRes: ', annoPartRes);

        // const completedParts = [imagesPartRes, annoPartRes].map((m, i) => ({ ETag: m.CopyPartResult.ETag, PartNumber: i + 1 }));
        // console.log('completed parts: ', completedParts);

        // // complete multipart upload
        // const s3ParamsComplete = {
        //   Key: mpObjKey,
        //   Bucket: bucket,
        //   UploadId: mpUploadId,
        //   MultipartUpload: {
        //     Parts: completedParts
        //   }
        // };
        // console.log('s3ParamsCompleteMPUpload: ', s3ParamsComplete);
        // const result = await s3.send(new CompleteMultipartUploadCommand(s3ParamsComplete));
        // console.log('multipart upload complete! ', result);

        // // END TESTING

        console.log('updating status document in s3 with urls: ', urls);
        // update status document in S3
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: `${documentId}.json`,
          Body: JSON.stringify({
            status: 'Success',
            urls: urls,
            imageCount,
            reviewedCount: { reviewed, notReviewed }
          }),
          ContentType: 'application/json; charset=utf-8'
        }));



        // imgs = JSON.stringify(imgs, null, 4);
        // annotations = JSON.stringify(annotations, null, 4);

        // const imagesPart = utils.uploadPart(s3, filename, bucket, imgs, mpUploadId, 1);
        // const annotationsPart = utils.uploadPart(s3, filename, bucket, annotations, mpUploadId, 2);
        // const uploadPromises = [imagesPart.uploadPromise, annotationsPart.uploadPromise];

        // transformToCoco.end();
        // const parts = await Promise.allSettled(uploadPromises);
        // console.log('finished uploading all the parts: ', parts);
        // parts.forEach((part) => {
        //   console.log('part metadata: ', part.value['$metadata']);
        // });
        // const completedParts = parts.map((m, i) => ({ ETag: m.value.ETag, PartNumber: i + 1 }));
        // console.log('completed parts: ', completedParts);

        // // complete multipart upload
        // const s3ParamsComplete = {
        //   Key: filename,
        //   Bucket: bucket,
        //   UploadId: mpUploadId,
        //   MultipartUpload: {
        //     Parts: completedParts
        //   }
        // };
        // console.log('s3ParamsCompleteMPUpload: ', s3ParamsComplete);
        // const result = await s3.send(new CompleteMultipartUploadCommand(s3ParamsComplete));
        // console.log('multipart upload complete! ', result);

      } else {
        console.log('unsupported format: ', format);
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
