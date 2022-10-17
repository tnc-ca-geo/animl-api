const { transform } = require('stream-transform');
const { PassThrough } = require('node:stream');
const { Upload } = require('@aws-sdk/lib-storage');
const moment = require('moment');
const { idMatch }  = require('../api/db/models/utils');

const flattenImgTransform = async (project, categories) => {

  return transform((img) => {
    const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, img.cameraId));
    const deployment = camConfig.deployments.find((dep) => idMatch(dep._id, img.deploymentId));

    const simpleImgRecord = {
      _id: img._id.toString(),
      dateAdded: moment(img.dateAdded).format(),  // TODO: or use toISOString()? see https://stackoverflow.com/questions/25725019/how-do-i-format-a-date-as-iso-8601-in-moment-js
      dateTimeOriginal: moment(img.dateTimeOriginal).format(),
      cameraId: img.cameraId.toString(),
      projectId: img.projectId.toString(),
      make: img.make,
      deploymentId: img.deploymentId.toString(),
      deploymentName: deployment.name,
      deploymentTimezone: deployment.timezone,
      ...(img.originalFileName && { originalFileName: img.originalFileName }),
      ...(deployment.location && {
        deploymentLat: deployment.location.geometry.coordinates[1],
        deploymentLong: deployment.location.geometry.coordinates[0]
      })
    };

    // build flattened reprentation of objects/labels
    const catCounts = {};
    categories.forEach((cat) => catCounts[cat] = null );
    for (const obj of img.objects) {
      const firstValidLabel = obj.labels.find((label) => (
        label.validation && label.validation.validated
      ));
      if (firstValidLabel) {
        const cat = firstValidLabel.category;
        catCounts[cat] = catCounts[cat] ? catCounts[cat] + 1 : 1;
      }
    }

    return {
      ...simpleImgRecord,
      ...catCounts
    };

  });
};

const streamToS3 = (key, bucket, client) => {
  // https://engineering.lusha.com/blog/upload-csv-from-large-data-table-to-s3-using-nodejs-stream/
  const pass = new PassThrough();
  const parallelUploads3 = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: pass,
      ContentType: 'text/csv'
    }
  });
  return {
    streamToS3: pass,
    uploadPromise: parallelUploads3.done()
  };
};

module.exports = {
  flattenImgTransform,
  streamToS3
};
