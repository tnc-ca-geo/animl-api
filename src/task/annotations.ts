import stream from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import { Upload } from '@aws-sdk/lib-storage';
import S3 from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InternalServerError } from '../api/errors.js';
import { type Transformer, transform } from 'stream-transform';
import { stringify } from 'csv-stringify';
import { DateTime } from 'luxon';
import { idMatch, buildPipeline } from '../api/db/models/utils.js';
import { ProjectModel } from '../api/db/models/Project.js';
import Image, { type ImageSchema } from '../api/db/schemas/Image.js';
import { type Config } from '../config/config.js';
import { type User } from '../api/auth/authorization.js';
import type { DeploymentSchema, FiltersSchema, ProjectSchema } from '../api/db/schemas/Project.js';
import type { ObjectSchema, LabelSchema } from '../api/db/schemas/shared/index.js';
import type { HydratedDocument, PipelineStage, Types } from 'mongoose';
import { type TaskInput } from '../api/db/models/Task.js';
import { ImageComment } from '../@types/graphql.js';
import { findRepresentativeLabel } from './utils.js';

export class AnnotationsExport {
  config: Config;
  s3: S3.S3Client;
  user: User;
  projectId: string;
  documentId: string;
  filters: FiltersSchema;
  timezone: string;
  format: string;
  ext: string;
  filename: string;
  bucket: string;
  onlyIncludeReviewed: boolean;
  presignedURL: string | null;
  imageCount: number;
  imageCountThreshold: number;
  reviewedCount: number;
  notReviewedCount: number;
  aggregateObjects: boolean;

  pipeline?: PipelineStage[];
  project?: HydratedDocument<ProjectSchema>;
  categories?: string[];
  labelMap?: Map<string, any>;

  constructor(
    {
      projectId,
      documentId,
      filters,
      format,
      timezone,
      onlyIncludeReviewed,
      aggregateObjects,
    }: {
      projectId: string;
      documentId: string;
      filters: FiltersSchema;
      format: string;
      timezone: string;
      onlyIncludeReviewed: boolean;
      aggregateObjects: boolean;
    },
    config: Config,
  ) {
    this.config = config;
    this.s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
    this.user = { is_superuser: true } as User;
    this.projectId = projectId;
    this.documentId = documentId;
    this.filters = filters;
    this.format = format;
    this.timezone = timezone;
    this.ext = format === 'coco' ? '.json' : '.csv';
    this.filename = `${documentId}_${format}${this.ext}`;
    this.bucket = config['/EXPORTS/EXPORTED_DATA_BUCKET'];
    this.onlyIncludeReviewed = onlyIncludeReviewed;
    this.aggregateObjects = aggregateObjects;
    this.presignedURL = null;
    this.imageCount = 0;
    this.imageCountThreshold = 18000; // TODO: Move to config?
    this.reviewedCount = 0;
    this.notReviewedCount = 0;
  }

  async init() {
    console.log('initializing Export');
    try {
      const sanitizedFilters = this.sanitizeFilters();
      const pipeline = buildPipeline(sanitizedFilters, this.projectId);

      let notReviewedPipeline = pipeline.map((stage) => ({ ...stage }));
      notReviewedPipeline.push({ $match: { reviewed: false } });
      let reviewedPipeline = pipeline.map((stage) => ({ ...stage }));
      reviewedPipeline.push({ $match: { reviewed: true } });

      this.notReviewedCount = await this.getCount(notReviewedPipeline);
      this.reviewedCount = await this.getCount(reviewedPipeline);

      if (this.onlyIncludeReviewed) {
        sanitizedFilters.reviewed = true;
      }

      this.pipeline = buildPipeline(sanitizedFilters, this.projectId);
      this.imageCount = await this.getCount(this.pipeline);

      const [project] = await ProjectModel.getProjects(
        { _ids: [this.projectId] },
        { user: this.user },
      );
      this.project = project;
      this.categories = project.labels.map((l) => {
        return l.name;
      });
      this.labelMap = new Map();
      for (const l of project.labels) this.labelMap.set(l._id, l);
    } catch (err) {
      throw new InternalServerError(
        'Error initializing the export class: ' + (err as Error).message,
      );
    }
  }

  async getCount(pipeline: PipelineStage[]): Promise<number> {
    let count = null;
    try {
      const pipelineCopy = pipeline.map((stage) => ({ ...stage }));
      pipelineCopy.push({ $count: 'count' });
      const res = await Image.aggregate(pipelineCopy);
      count = res[0] ? res[0].count : 0;
    } catch (err) {
      throw new InternalServerError('Error counting images: ' + (err as Error).message);
    }
    return count;
  }

  async toCSV(): Promise<AnnotationOutput> {
    console.log('exporting to CSV');

    try {
      console.time('CSV export time');
      // prep transformation and upload streams
      const flattenImg = this.flattenImgTransform();
      const columns = this.config.CSV_EXPORT_COLUMNS.concat(this.categories!);
      const createRow = stringify({ header: true, columns });
      const { streamToS3, promise } = this.streamToS3(this.filename);

      // log memory usage every 10k images (just for testing)
      const logMemoryUsage = transform((data) => {
        const { finished } = logMemoryUsage.state;
        if (finished === 1 || finished % 10000 === 0) {
          console.log(
            `Processed ${finished} images. remaining memory: ${JSON.stringify(
              process.memoryUsage(),
            )}`,
          );
        }
        return data;
      });

      // create a Mongoose aggregation cursor to read in documents one at a time
      const cursor = Image.aggregate(this.pipeline).cursor();

      // pipe together aggregation cursor, transform and write streams
      await stream.pipeline(cursor, flattenImg, createRow, logMemoryUsage, streamToS3);

      // wait for upload complete
      await promise;
      console.log('upload complete');
      console.timeEnd('CSV export time');
    } catch (err) {
      throw new InternalServerError('Error exporting to CSV: ' + (err as Error).message);
    }

    // get presigned url for new S3 object (expires in one hour)
    this.presignedURL = await this.getPresignedURL();

    return {
      url: this.presignedURL,
      count: this.imageCount,
      meta: {
        reviewedCount: {
          reviewed: this.reviewedCount,
          notReviewed: this.notReviewedCount,
        },
      },
    };
  }

  async toCOCO(): Promise<AnnotationOutput> {
    console.log('exporting to coco');
    try {
      // create categories map & string
      let catMap = [{ name: 'empty' }];
      this.categories?.forEach((cat) => {
        if (cat !== 'empty') catMap.push({ name: cat });
      });
      catMap = catMap.map((cat, i) => ({ id: i, name: cat.name }));
      const catString = JSON.stringify(catMap, null, 4);

      // create info object & string
      const info = {
        version: '1.0',
        description:
          `Image data exported from Animl project '${this.projectId}'.` +
          ` Export ID: ${this.documentId}`,
        year: DateTime.now().setZone(this.timezone).get('year'),
        date_created: DateTime.now().setZone(this.timezone).toISO(),
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
      throw new InternalServerError('Error exporting to COCO: ' + (err as Error).message);
    }

    // get presigned url for new S3 object (expires in one hour)
    this.presignedURL = await this.getPresignedURL();

    return {
      url: this.presignedURL,
      count: this.imageCount,
      meta: {
        reviewedCount: {
          reviewed: this.reviewedCount,
          notReviewed: this.notReviewedCount,
        },
      },
    };
  }

  async multipartUpload(catString: string, infoString: string, catMap: Category[]): Promise<void> {
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
      const objectsToAnnotate = this.onlyIncludeReviewed
        ? this.getReviewedObjects(img)
        : img.objects;

      for (const [o, obj] of objectsToAnnotate.entries()) {
        const annoObj = this.createCOCOAnnotation(obj, img, catMap);
        // skip if no representative label found (i.e. object has all invalidated labels)
        if (!annoObj) continue;
        let annoString = JSON.stringify(annoObj, null, 4);
        annoString =
          i === this.imageCount && o === objectsToAnnotate.length - 1
            ? annoString + '], "categories": ' + catString + ', "info":' + infoString + '}'
            : annoString + ', ';
        annotationsUpload.streamToS3.write(annoString);
      }

      if (i % 10000 === 0) {
        console.log(
          `processed img count: ${i}. remaining memory: ${JSON.stringify(process.memoryUsage())}`,
        );
      }
    }

    // end both upload streams and wait for promises to finish
    imagesUpload.streamToS3.end();
    annotationsUpload.streamToS3.end();
    const res = await Promise.allSettled([imagesUpload.promise, annotationsUpload.promise]);
    console.log('finished uploading all the parts: ', res);

    // concatenate images and annotations .json files via multipart upload copy part
    const initResponse = await this.s3.send(
      new S3.CreateMultipartUploadCommand({
        Key: this.filename,
        Bucket: this.bucket,
      }),
    );
    const mpUploadId = initResponse['UploadId'];
    console.log('multipart upload initiated: ', mpUploadId);

    const parts = [imagesFilename, annotationsFilename].map((part, i) => ({
      params: {
        Bucket: this.bucket,
        Key: this.filename,
        CopySource: `${this.bucket}/${part}`,
        PartNumber: i + 1,
        UploadId: mpUploadId,
      },
    }));
    const imagesPartRes = await this.s3.send(new S3.UploadPartCopyCommand(parts[0].params));
    const annoPartRes = await this.s3.send(new S3.UploadPartCopyCommand(parts[1].params));
    const completedParts = [imagesPartRes, annoPartRes].map((m, i) => ({
      ETag: m.CopyPartResult?.ETag,
      PartNumber: i + 1,
    }));
    console.log('completed parts: ', completedParts);

    const result = await this.s3.send(
      new S3.CompleteMultipartUploadCommand({
        Key: this.filename,
        Bucket: this.bucket,
        UploadId: mpUploadId,
        MultipartUpload: { Parts: completedParts },
      }),
    );
    console.log('multipart upload complete! ', result);
  }

  async putUpload(
    catMap: Category[],
    info: {
      version: string;
      description: string;
      year: number;
      date_created: string | null;
    },
  ): Promise<void> {
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
      const objectsToAnnotate = this.onlyIncludeReviewed
        ? this.getReviewedObjects(img)
        : img.objects;

      for (const obj of objectsToAnnotate) {
        const annoObj = this.createCOCOAnnotation(obj, img, catMap);
        if (!annoObj) continue; // skip if no representative label found
        annotationsArray.push(annoObj);
      }
    }

    // combine images, annotations, categories, and info objects, stringify
    const data = JSON.stringify(
      {
        images: imagesArray,
        annotations: annotationsArray,
        categories: catMap,
        info: info,
      },
      null,
      4,
    );

    // upload to S3 via putObject
    console.log('uploading data to s3');
    const res = await this.s3.send(
      new S3.PutObjectCommand({
        Bucket: this.bucket,
        Key: this.filename,
        Body: data,
        ContentType: 'application/json; charset=utf-8',
      }),
    );
    console.log('successfully uploaded to s3: ', res);
  }

  // Flatten and join comments to single string
  // Format: author:comment;author:comment;...
  flattenComments(comments: ImageComment[]): string {
    const serializedComments = comments.map((comment) => {
      // Replace new lines with escaped newlines in output
      const escapedNewLine = comment.comment.replaceAll('\n', '\\n');
      return `${comment.author}: ${escapedNewLine}`;
    });
    const joinedComments = serializedComments.join('; ');

    return joinedComments;
  }

  // Lookup Project Tags and join tag names to single string
  flattenTags(imageTags: string[]): string {
    if (!this.project) throw new InternalServerError('Project not initialized for tag flattening');
    const imageTagIds = imageTags.map((tag) => tag.toString());
    const tagNames = this.project.tags
      .filter((projectTag) => imageTagIds.includes(projectTag._id.toString()))
      .map((projectTag) => projectTag.name);
    return tagNames.join(', ');
  }

  flattenImgTransform(): Transformer {
    return transform((img) => {
      let catCounts: Record<string, any> = {};

      const deployment = this.getDeployment(img);
      const imgDateTime = DateTime.fromJSDate(img.dateTimeAdjusted);
      const validatedBy = this.getValidatedByForCSV(img);
      const flatImgRecord = {
        _id: img._id,
        dateAdded: DateTime.fromJSDate(img.dateAdded).setZone(this.timezone).toISO(),
        dateTimeOriginal: imgDateTime.setZone(this.timezone).toISO(),
        cameraId: img.cameraId,
        projectId: img.projectId,
        make: img.make,
        deploymentId: img.deploymentId.toString(),
        deploymentName: deployment.name === 'default' ? `${img.cameraId}-default` : deployment.name,
        deploymentTimezone: deployment.timezone,
        ...(img.originalFileName && { originalFileName: img.originalFileName }),
        ...(img.path && { path: img.path }),
        ...(deployment.location && {
          deploymentLat: deployment.location.geometry.coordinates[1],
          deploymentLong: deployment.location.geometry.coordinates[0],
        }),
        ...(img.comments && { comments: this.flattenComments(img.comments) }),
        ...(img.tags && { tags: this.flattenTags(img.tags) }),
        validatedBy: validatedBy,
      };

      this.categories!.forEach((cat) => (catCounts[cat] = null));
      for (const obj of img.objects) {
        const representativeLabel = findRepresentativeLabel(obj);
        if (representativeLabel) {
          const cat = this.labelMap!.get(representativeLabel.labelId).name;
          if (this.aggregateObjects) {
            catCounts[cat] = 1;
          } else {
            catCounts[cat] = catCounts[cat] ? catCounts[cat] + 1 : 1;
          }
        }
      }
      return { ...flatImgRecord, ...catCounts };
    });
  }

  sanitizeFilters(): Record<
    string,
    string | boolean | DateTime<true> | DateTime<false> | Date | string[] | null
  > {
    const sanitizedFilters: Record<
      string,
      string | boolean | Date | DateTime<true> | DateTime<false> | string[] | null
    > = {};
    // parse ISO strings into DateTimes
    for (const [key, value] of Object.entries(this.filters)) {
      if ((key.includes('Start') || key.includes('End')) && value) {
        const dt = !DateTime.isDateTime(value) ? DateTime.fromISO(value as string) : value;
        sanitizedFilters[key] = dt;
      } else {
        sanitizedFilters[key] = value;
      }
    }
    return sanitizedFilters;
  }

  // Concatenate all users who validated the most representative label for
  // each object in the image
  getValidatedByForCSV(img: ImageSchema): string {
    if (!img.reviewed) {
      return "Not Reviewed";
    }
    const validatedBy = new Set<string>();
    for (const obj of img.objects) {
      const representativeLabel = findRepresentativeLabel(obj);
      if (
        representativeLabel && 
        representativeLabel.validation &&
        representativeLabel.validation.validated &&
        representativeLabel.validation.userId
      ) {
        validatedBy.add(representativeLabel.validation.userId);
      }
    }
    return [...validatedBy].join("; ");
  }

  getDeployment(img: ImageSchema): DeploymentSchema {
    const camConfig = this.project!.cameraConfigs.find((cc) => idMatch(cc._id, img.cameraId));
    const deployment = camConfig?.deployments.find((dep) => idMatch(dep._id, img.deploymentId));
    if (!deployment) throw new InternalServerError('Error finding deployment for image');
    return deployment;
  }

  getPresignedURL(): Promise<string> {
    console.log('getting presigned url');
    const command = new S3.GetObjectCommand({ Bucket: this.bucket, Key: this.filename });
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  streamToS3(filename: string): {
    streamToS3: PassThrough;
    promise: Promise<S3.CompleteMultipartUploadCommandOutput>;
  } {
    // https://engineering.lusha.com/blog/upload-csv-from-large-data-table-to-s3-using-nodejs-stream/
    const contentType = this.format === 'csv' ? 'text/csv' : 'application/json; charset=utf-8';
    const pass = new PassThrough();
    const parallelUploadS3 = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: filename,
        Body: pass,
        ContentType: contentType,
      },
    });
    return {
      streamToS3: pass,
      promise: parallelUploadS3.done(),
    };
  }

  getReviewedObjects(img: HydratedDocument<ImageSchema>): ObjectSchema[] {
    return img.objects.filter((obj) => {
      const hasValidatedLabel = obj.labels.find(
        (label) => label.validation && label.validation.validated,
      );
      return obj.locked && hasValidatedLabel;
    });
  }

  createCOCOImg(img: ImageSchema): {
    id: string;
    file_name: string;
    original_file_name?: Maybe<string>;
    serving_bucket_key: string;
    datetime: string | null;
    location: string;
    width?: number;
    height?: number;
  } {
    const deployment = this.getDeployment(img);
    const deploymentNormalized = deployment.name
      .toLowerCase()
      .replaceAll("'", '')
      .replaceAll(' ', '_');
    // Note - replacing ":" in imageIds with "-" because colons are reserved characters in windows filesystems
    const destPath = `${this.projectId}/${img.cameraId}/${deploymentNormalized}/${img._id.replace(
      ':',
      '-',
    )}.${img.fileTypeExtension}`;
    const servingPath = `original/${img._id}-original.${img.fileTypeExtension}`;
    const adjustedDateTime = DateTime.fromJSDate(img.dateTimeAdjusted);
    return {
      id: img._id,
      file_name: destPath,
      original_file_name: img.originalFileName,
      serving_bucket_key: servingPath,
      datetime: adjustedDateTime.setZone(this.timezone).toISO(),
      location: deployment.name === 'default' ? `${img.cameraId}-default` : deployment.name,
      ...(img.imageWidth && { width: img.imageWidth }),
      ...(img.imageHeight && { height: img.imageHeight }),
    };
  }

  createCOCOAnnotation(
    object: ObjectSchema,
    img: ImageSchema,
    catMap: Category[],
  ): {
    id: Types.ObjectId;
    image_id: string;
    category_id?: number;
    sequence_level_annotation: boolean;
    bbox: number[];
    confidence: number | null | undefined;
    validated: boolean;
    validated_by: string;
  } | null {
    let anno = null;
    const representativeLabel = findRepresentativeLabel(object);
    if (representativeLabel) {
      const category = catMap.find(
        (cat) => cat.name === this.labelMap!.get(representativeLabel.labelId).name,
      );
      if (!category)
        throw new InternalServerError('Error finding category for representative label');
      anno = {
        id: object._id, // id copied from the object, not the label
        image_id: img._id,
        category_id: category.id,
        sequence_level_annotation: false,
        bbox: this.relToAbs(object.bbox, img.imageWidth!, img.imageHeight!),
        confidence: representativeLabel.conf,
        validated: representativeLabel.validation?.validated || false,
        validated_by: representativeLabel.validation?.userId || "Not Reviewed",
      };
    }
    return anno;
  }

  relToAbs(
    bbox: number[],
    imageWidth: number,
    imageHeight: number,
  ): [number, number, number, number] {
    // convert bbox in relative vals ([ymin, xmin, ymax, xmax])
    // to absolute values ([x,y,width,height])
    const x = Math.round(bbox[1] * imageWidth);
    const y = Math.round(bbox[0] * imageHeight);
    const width = Math.round((bbox[3] - bbox[1]) * imageWidth);
    const height = Math.round((bbox[2] - bbox[0]) * imageHeight);
    return [x, y, width, height];
  }
}

export default async function (
  task: TaskInput<{
    filters: FiltersSchema;
    format: any;
    timezone: string;
    onlyIncludeReviewed: boolean;
    aggregateObjects: boolean;
  }> & { _id: string },
  config: Config,
): Promise<AnnotationOutput> {
  const dataExport = new AnnotationsExport(
    {
      projectId: task.projectId,
      documentId: task._id,
      filters: task.config.filters,
      format: task.config.format,
      timezone: task.config.timezone,
      onlyIncludeReviewed: task.config.onlyIncludeReviewed,
      aggregateObjects: task.config.aggregateObjects,
    },
    config,
  );

  await dataExport.init();
  if (!task.config.format || task.config.format === 'csv') {
    return await dataExport.toCSV();
  } else if (task.config.format === 'coco') {
    return await dataExport.toCOCO();
  } else {
    throw new Error(`Unsupported export format (${task.config.format})`);
  }
}

interface AnnotationOutput {
  url: string;
  count: number;
  meta: { reviewedCount: { reviewed: number; notReviewed: number } };
}

interface Category {
  id?: number;
  name: string;
}
