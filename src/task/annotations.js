import stream from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import { Upload } from '@aws-sdk/lib-storage';
import S3 from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InternalServerError } from '../api/errors.js';
import { transform } from 'stream-transform';
import { stringify } from 'csv-stringify';
import { DateTime } from 'luxon';
import { idMatch }  from '../api/db/models/utils.js';
import { ProjectModel } from '../api/db/models/Project.js';
import Image from '../api/db/schemas/Image.js';
import { buildPipeline } from '../api/db/models/utils.js';

export class AnnotationsExport {
  constructor({ projectId, documentId, filters, format }, config) {
    this.config = config;
    this.s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
    this.user = { 'is_superuser': true };
    this.projectId = projectId;
    this.documentId = documentId;
    this.filters = filters;
    this.format = format;
    this.ext = format === 'coco' ? '.json' : '.csv';
    this.filename = `${documentId}_${format}${this.ext}`;
    this.bucket = config['/EXPORTS/EXPORTED_DATA_BUCKET'];
    this.onlyIncludeReviewed = true;  // TODO: move into config or expose as option?
    this.presignedURL = null;
    this.imageCount = 0;
    this.imageCountThreshold = 18000;  // TODO: Move to config?
    this.reviewedCount = 0;
    this.notReviewedCount = 0;
  }

  async init() {
    console.log('initializing Export');
    try {
      const sanitizedFilters = this.sanitizeFilters();
      const notReviewedPipeline = buildPipeline(
        { ...sanitizedFilters, reviewed: false },
        this.projectId
      );
      this.notReviewedCount = await this.getCount(notReviewedPipeline);

      // add notReviewed = false filter
      if (this.onlyIncludeReviewed && (sanitizedFilters.notReviewed !== false)) {
        sanitizedFilters.notReviewed = false;
      }
      this.pipeline = buildPipeline(sanitizedFilters, this.projectId);
      this.imageCount = await this.getCount(this.pipeline);
      this.reviewedCount = this.imageCount;
      console.log('imageCount: ', this.imageCount);

      const [project] = await ProjectModel.getProjects(
        { _ids: [this.projectId] },
        { user: this.user }
      );
      this.project = project;
      this.categories = project.labels.map((l) => { return l.name; });
      this.labelMap = new Map();
      for (const l of project.labels) this.labelMap.set(l._id, l);
    } catch (err) {
      throw new InternalServerError('Error initializing the export class: ' + err.message);
    }
  }

  async getCount(pipeline) {
    console.log('getting image count');
    let count = null;
    try {
      const pipelineCopy = pipeline.map((stage) => ({ ...stage }));
      pipelineCopy.push({ $count: 'count' });
      const res = await Image.aggregate(pipelineCopy);
      console.log('res: ', res);
      count = res[0] ? res[0].count : 0;
    } catch (err) {
      throw new InternalServerError('Error counting images: ' + err.message);
    }
    return count;
  }

  async toCSV() {
    console.log('exporting to CSV');
    try {
      // prep transformation and upload streams
      const flattenImg = this.flattenImgTransform();
      const columns = this.config.CSV_EXPORT_COLUMNS.concat(this.categories);
      const createRow = stringify({ header: true, columns });
      const { streamToS3, promise } = this.streamToS3(this.filename);

      // stream in images from MongoDB, write to transformation stream
      for await (const img of Image.aggregate(this.pipeline)) {
        flattenImg.write(img);
      }
      flattenImg.end();

      // pipe together transform and write streams
      await stream.pipeline(
        flattenImg,
        createRow,
        streamToS3
      );

      // wait for upload complete
      await promise;
      console.log('upload complete');
    } catch (err) {
      throw new InternalServerError('Error exporting to CSV: ' + err.message);
    }

    // get presigned url for new S3 object (expires in one hour)
    this.presignedURL = await this.getPresignedURL();

    return {
      url: this.presignedURL,
      count: this.imageCount,
      meta: {
        reviewedCount: {
          reviewed: this.reviewedCount,
          notReviewed: this.notReviewedCount
        }
      }
    };
  }

  async toCOCO() {
    console.log('exporting to coco');
    try {
      // create categories map & string
      let catMap = [{ 'name': 'empty' }];
      this.categories.forEach((cat) => {
        if (cat !== 'empty') catMap.push({ 'name': cat });
      });
      catMap = catMap.map((cat, i) => ({ 'id': i, 'name': cat.name }));
      const catString = JSON.stringify(catMap, null, 4);

      // create info object & string
      const info = {
        version : '1.0',
        description : `Image data exported from Animl project '${this.projectId}'.` +
          ` Export ID: ${this.documentId}`,
        year : DateTime.now().get('year'),
        date_created: DateTime.now().toISO()
      };
      const infoString = JSON.stringify(info, null, 4);

      if (this.imageCount > this.imageCountThreshold) {
        // image count is too high to read all the images into memory, so
        // stream the results in from DB, splitting out images and annotations
        // and streaming them separately to their own S3 objects, and then
        // concatenate the objects via Multipart Upload copy part
        await this.multipartUpload(catString, infoString, catMap);
      } else {
        // image count is small enough to read all the images into memory, so
        // build COCO file, and upload to S3 via putObjectCommand
        await this.putUpload(catMap, info);
      }
    } catch (err) {
      throw new InternalServerError('Error exporting to COCO: ' + err.message);
    }

    // get presigned url for new S3 object (expires in one hour)
    this.presignedURL = await this.getPresignedURL();

    return {
      url: this.presignedURL,
      count: this.imageCount,
      meta: {
        reviewedCount: {
          reviewed: this.reviewedCount,
          notReviewed: this.notReviewedCount
        }
      }
    };
  }

  async multipartUpload(catString, infoString, catMap) {
    console.log('uploading via multipart');

    // TODO: review try/catch strategy through out and make make sure
    // none are not redundant or missing.

    // prep upload parts
    const imagesFilename = `${this.documentId}_images${this.ext}`;
    const annotationsFilename = `${this.documentId}_annotations${this.ext}`;
    const imagesUpload = this.streamToS3(imagesFilename);
    const annotationsUpload = this.streamToS3(annotationsFilename);

    // stream in image documents from MongoDB, split out and write images
    // and annotations to separate upload streams
    imagesUpload.streamToS3.write('{"images": [');
    annotationsUpload.streamToS3.write('], "annotations": [');

    let i = 0;
    for await (const img of Image.aggregate(this.pipeline)) {
      i++;

      // create COCO image record, write to upload stream
      const imgObj = this.createCOCOImg(img);
      let imgString = JSON.stringify(imgObj, null, 4);
      imgString = i === this.imageCount ? imgString : imgString + ', ';
      imagesUpload.streamToS3.write(imgString);

      // create COCO annotation record, write to upload stream
      const reviewedObjects = this.getReviewedObjects(img);
      for (const [o, obj] of reviewedObjects.entries()) {
        const annoObj = this.createCOCOAnnotation(obj, img, catMap);
        let annoString = JSON.stringify(annoObj, null, 4);
        annoString = (i === this.imageCount && o === reviewedObjects.length - 1)
          ? annoString + '], "categories": ' + catString + ', "info":' + infoString + '}'
          : annoString + ', ';
        annotationsUpload.streamToS3.write(annoString);
      }
    }

    // end both upload streams and wait for promises to finish
    imagesUpload.streamToS3.end();
    annotationsUpload.streamToS3.end();
    const res = await Promise.allSettled([
      imagesUpload.promise,
      annotationsUpload.promise
    ]);
    console.log('finished uploading all the parts: ', res);

    // concatonate images and annotations .json files via multipart upload copy part
    const initResponse = await this.s3.send(new S3.CreateMultipartUploadCommand({
      Key: this.filename,
      Bucket: this.bucket
    }));
    const mpUploadId = initResponse['UploadId'];
    console.log('multipart upload initiated: ', mpUploadId);

    const parts = [imagesFilename, annotationsFilename].map((part, i) => ({
      params: {
        Bucket: this.bucket,
        Key: this.filename,
        CopySource: `${this.bucket}/${part}`,
        PartNumber: i + 1,
        UploadId: mpUploadId
      }
    }));
    const imagesPartRes = await this.s3.send(new S3.UploadPartCopyCommand(parts[0].params));
    const annoPartRes = await this.s3.send(new S3.UploadPartCopyCommand(parts[1].params));
    const completedParts = [imagesPartRes, annoPartRes].map((m, i) => ({
      ETag: m.CopyPartResult.ETag, PartNumber: i + 1
    }));
    console.log('completed parts: ', completedParts);

    const result = await this.s3.send(new S3.CompleteMultipartUploadCommand({
      Key: this.filename,
      Bucket: this.bucket,
      UploadId: mpUploadId,
      MultipartUpload: { Parts: completedParts }
    }));
    console.log('multipart upload complete! ', result);
  }

  async putUpload(catMap, info) {
    console.log('uploading via put');

    const imagesArray = [];
    const annotationsArray = [];

    // get all images from MongoDB
    const images = await Image.aggregate(this.pipeline);
    for (const img of images) {
      // create COCO image record, add to in-memory array
      const imgObj = this.createCOCOImg(img);
      imagesArray.push(imgObj);

      // create COCO annotation record, add to in-memory array
      const reviewedObjects = this.getReviewedObjects(img);
      for (const obj of reviewedObjects) {
        const annoObj = this.createCOCOAnnotation(obj, img, catMap);
        annotationsArray.push(annoObj);
      }
    }

    // combine images, annotations, categories, and info objects, stringify
    const data = JSON.stringify({
      images: imagesArray,
      annotations: annotationsArray,
      categories: catMap,
      info: info
    }, null, 4);

    // upload to S3 via putObject
    console.log('uploading data to s3');
    const res = await this.s3.send(new S3.PutObjectCommand({
      Bucket: this.bucket,
      Key: this.filename,
      Body: data,
      ContentType: 'application/json; charset=utf-8'
    }));
    console.log('successfully uploaded to s3: ', res);
  }

  flattenImgTransform() {
    return transform((img) => {
      const deployment = this.getDeployment(img, this.project);
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
      this.categories.forEach((cat) => catCounts[cat] = null );
      for (const obj of img.objects) {
        const firstValidLabel = this.findFirstValidLabel(obj);
        if (firstValidLabel) {
          console.error(firstValidLabel, this.labelMap);
          const cat = this.labelMap.get(firstValidLabel.labelId).name;
          catCounts[cat] = catCounts[cat] ? catCounts[cat] + 1 : 1;
        }
      }

      return { ...flatImgRecord, ...catCounts };
    });
  }

  sanitizeFilters() {
    console.log('sanitizing filters');
    const sanitizedFilters = {};
    // parse ISO strings into DateTimes
    for (const [key, value] of Object.entries(this.filters)) {
      if ((key.includes('Start') || key.includes('End')) && value) {
        const dt = !DateTime.isDateTime(value) ? DateTime.fromISO(value) : value;
        sanitizedFilters[key] = dt;
      } else {
        sanitizedFilters[key] = value;
      }
    }
    return sanitizedFilters;
  }

  findFirstValidLabel(obj) {
    return obj.labels.find((label) => (
      label.validation && label.validation.validated
    ));
  }

  getDeployment(img) {
    const camConfig = this.project.cameraConfigs.find((cc) => (
      idMatch(cc._id, img.cameraId)
    ));
    return camConfig.deployments.find((dep) => (
      idMatch(dep._id, img.deploymentId))
    );
  }

  async getPresignedURL() {
    console.log('getting presigned url');
    const command = new S3.GetObjectCommand({ Bucket: this.bucket, Key: this.filename });
    return await getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  streamToS3(filename) {
    // https://engineering.lusha.com/blog/upload-csv-from-large-data-table-to-s3-using-nodejs-stream/
    const contentType = this.format === 'csv' ? 'text/csv' : 'application/json; charset=utf-8';
    const pass = new PassThrough();
    const parallelUploadS3 = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: filename,
        Body: pass,
        ContentType: contentType
      }
    });
    return {
      streamToS3: pass,
      promise: parallelUploadS3.done()
    };
  }

  getReviewedObjects(img) {
    return img.objects.filter((obj) => {
      const hasValidatedLabel = obj.labels.find((label) => (
        label.validation && label.validation.validated
      ));
      return obj.locked && hasValidatedLabel;
    });
  }

  createCOCOImg(img) {
    const deployment = this.getDeployment(img, this.project);
    const deploymentNormalized = deployment.name.toLowerCase().replaceAll("'", '').replaceAll(' ', '_');
    // Note - replacing ":" in imageIds with "-" because colons are reserved characters in windows filesystems
    const destPath = `${this.projectId}/${img.cameraId}/${deploymentNormalized}/${img._id.replace(':', '-')}.${img.fileTypeExtension}`;
    const servingPath = `original/${img._id}-original.${img.fileTypeExtension}`;
    return {
      id: img._id,
      file_name: destPath,
      original_file_name: img.originalFileName,
      serving_bucket_key: servingPath,
      datetime: img.dateTimeOriginal,
      location: deployment.name,
      ...(img.imageWidth &&  { width: img.imageWidth }),
      ...(img.imageHeight && { height: img.imageHeight })
    };
  }

  createCOCOAnnotation(object, img, catMap) {
    let anno;
    const firstValidLabel = this.findFirstValidLabel(object);
    if (firstValidLabel) {
      const category = catMap.find((cat) => cat.name === this.labelMap.get(firstValidLabel.labelId).name);
      anno = {
        id: object._id,  // id copied from the object, not the label
        image_id: img._id,
        category_id: category.id,
        sequence_level_annotation: false,
        bbox: this.relToAbs(object.bbox, img.imageWidth, img.imageHeight)
      };
    }
    return anno;
  }

  relToAbs(bbox, imageWidth, imageHeight) {
    // convert bbox in relative vals ([ymin, xmin, ymax, xmax])
    // to absolute values ([x,y,width,height])
    const x =       Math.round(bbox[1] * imageWidth);
    const y =       Math.round(bbox[0] * imageHeight);
    const width =   Math.round((bbox[3] - bbox[1]) * imageWidth);
    const height =  Math.round((bbox[2] - bbox[0]) * imageHeight);
    return [x, y, width, height];
  }

}

export default async function(task, config) {
  const dataExport = new AnnotationsExport({
    projectId: task.projectId,
    documentId: task._id,
    filters: task.config.filters,
    format: task.config.format
  }, config);

  await dataExport.init();

  if (!task.config.format || task.config.format === 'csv') {
    return await dataExport.toCSV();
  } else if (task.config.format === 'coco') {
    return await dataExport.toCOCO();
  } else {
    throw new Error(`Unsupported export format (${task.config.format})`);
  }
}

