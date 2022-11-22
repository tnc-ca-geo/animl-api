const { transform } = require('stream-transform');
const { PassThrough } = require('node:stream');
const { Upload } = require('@aws-sdk/lib-storage');
const { CreateMultipartUploadCommand, UploadPartCommand } = require('@aws-sdk/client-s3');
const { DateTime } = require('luxon');
const { idMatch }  = require('../api/db/models/utils');
const { ApolloError } = require('apollo-server-lambda');

const findFirstValidLabel = (obj) => {
  return obj.labels.find((label) => (
    label.validation && label.validation.validated
  ));
};

const sanitizeFilters = (filters, onlyIncludeReviewed) => {
  const sanitizedFilters = {};
  // parse ISO strings into DateTimes
  for (const [key, value] of Object.entries(filters)) {
    if ((key.includes('Start') || key.includes('End')) && value) {
      const dt = !DateTime.isDateTime(value) ? DateTime.fromISO(value) : value;
      sanitizedFilters[key] = dt;
    } else {
      sanitizedFilters[key] = value;
    }
  }

  // add notReviewed = false filter
  if (onlyIncludeReviewed && (sanitizedFilters.notReviewed !== false)) {
    sanitizedFilters.notReviewed = false;
  }
  return sanitizedFilters;
};

const flattenImgTransform = async (project, categories) => {

  return transform((img) => {
    const camConfig = project.cameraConfigs.find((cc) => idMatch(cc._id, img.cameraId));
    const deployment = camConfig.deployments.find((dep) => idMatch(dep._id, img.deploymentId));

    const flatImgRecord = {
      _id: img._id.toString(),
      dateAdded: DateTime.fromJSDate(img.dateAdded).toISO(),
      dateTimeOriginal: DateTime.fromJSDate(img.dateTimeOriginal).toISO(),
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

    // build flattened representation of objects/labels
    const catCounts = {};
    categories.forEach((cat) => catCounts[cat] = null );
    for (const obj of img.objects) {
      const firstValidLabel = findFirstValidLabel(obj);
      if (firstValidLabel) {
        const cat = firstValidLabel.category;
        catCounts[cat] = catCounts[cat] ? catCounts[cat] + 1 : 1;
      }
    }

    return {
      ...flatImgRecord,
      ...catCounts
    };

  });
};

const streamToS3 = (format, key, bucket, client) => {
  // https://engineering.lusha.com/blog/upload-csv-from-large-data-table-to-s3-using-nodejs-stream/
  const contentType = format === 'csv' ? 'text/csv' : 'application/json; charset=utf-8';
  const pass = new PassThrough();
  const parallelUploadS3 = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: pass,
      ContentType: contentType
    }
  });
  return {
    streamToS3: pass,
    promise: parallelUploadS3.done()
  };
};

const initiateMultipartUpload = async (client, params) => {
  try {
    const res = await client.send(new CreateMultipartUploadCommand(params));
    return res;
  } catch (err){
    throw new ApolloError(err);
  }
};

const uploadPart = (client, key, bucket, body, UploadId, partNumber) => {
  const params = {
    Key: key,
    Bucket: bucket,
    Body: body,
    UploadId: UploadId,
    PartNumber: partNumber
    // contentType: 'application/json; charset=utf-8'
  };

  console.log('creating upload part with params: ', params);

  return {
    uploadPromise: client.send(new UploadPartCommand(params))
  };
};

const getReviewedObjects = (img) => {
  return img.objects.filter((obj) => {
    const hasValidatedLabel = obj.labels.find((label) => (
      label.validation && label.validation.validated
    ));
    return obj.locked && hasValidatedLabel;
  });
};

const createCOCOImg = (img) => {
  const fileNameNoExt = img.originalFileName.split('.')[0];
  const archivePath = `${img.cameraId}/${fileNameNoExt}_${img._id}.${img.fileTypeExtension}`;
  return {
    id: img._id,
    file_name: img.originalFileName,
    original_relative_path: archivePath,
    datetime: img.dateTimeOriginal,
    location: img.deploymentId,
    ...(img.imageWidth &&  { width: img.imageWidth }),
    ...(img.imageHeight && { height: img.imageHeight })
  };
};

// convert bbox in relative vals ([ymin, xmin, ymax, xmax])
// to absolute values ([x,y,width,height])
const relToAbs = (bbox, imageWidth, imageHeight) => {
  const left =    Math.round(bbox[1] * imageWidth);
  const top =     Math.round(bbox[0] * imageHeight);
  const width =   Math.round((bbox[3] - bbox[1]) * imageWidth);
  const height =  Math.round((bbox[2] - bbox[0]) * imageHeight);
  return { left, top, width, height };
};

const createCOCOAnnotation = (object, img, catMap) => {
  let anno;
  const firstValidLabel = findFirstValidLabel(object);
  if (firstValidLabel) {
    const category = catMap.find((cat) => cat.name === firstValidLabel.category);
    anno = {
      id: object._id,  // id copied from the object, not the label
      image_id: img._id,
      category_id: category.id,
      sequence_level_annotation: false,
      bbox: relToAbs(object.bbox, img.imageWidth, img.imageHeight)
    };
  }
  return anno;
};

module.exports = {
  sanitizeFilters,
  flattenImgTransform,
  streamToS3,
  initiateMultipartUpload,
  uploadPart,
  getReviewedObjects,
  createCOCOImg,
  createCOCOAnnotation
};
