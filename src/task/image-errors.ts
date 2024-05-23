import { DateTime } from 'luxon';
import stream from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import { Upload } from '@aws-sdk/lib-storage';
import S3 from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InternalServerError } from '../api/errors.js';
import { stringify } from 'csv-stringify';
import ImageError from '../api/db/schemas/ImageError.js';
import { ImageErrorModel } from '../api/db/models/ImageError.js';
import { Config } from '../config/config.js';
import { TaskInput } from '../api/db/models/Task.js';

export class ImageErrorExport {
  config: Config;
  s3: S3.S3Client;
  ext: string;
  documentId: ImageErrorExportInput['documentId'];
  filename: string;
  bucket: string;
  errorCount: number;
  imageCountThreshold: number;
  filters: ImageErrorExportInput['filters'];
  pipeline: any[];
  presignedURL?: string;

  constructor({ documentId, filters, format }: ImageErrorExportInput, config: Config) {
    this.config = config;
    this.s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
    this.ext = '.csv';
    this.documentId = documentId;
    this.filename = `${documentId}_${format}${this.ext}`;
    this.bucket = config['/EXPORTS/EXPORTED_DATA_BUCKET'];
    this.errorCount = 0;
    this.imageCountThreshold = 18000; // TODO: Move to config?
    this.filters = filters;
    this.pipeline = [{ $match: { batch: filters.batch } }];
  }

  async init() {
    console.log('initializing Export');
    try {
      this.errorCount = await ImageErrorModel.countImageErrors(this.filters);
      console.log('errorCount: ', this.errorCount);
    } catch (err) {
      throw new InternalServerError(
        'error initializing the export class: ' + (err as Error).message,
      );
    }
  }

  async getCount(pipeline: any) {
    console.log('getting error count');
    let count = null;
    try {
      pipeline = JSON.parse(JSON.stringify(pipeline));
      pipeline.push({ $count: 'count' });

      const res = await ImageError.aggregate(pipeline);
      console.log('res: ', res);
      count = res[0] ? res[0].count : 0;
    } catch (err) {
      throw new InternalServerError('error counting ImageError: ' + (err as Error).message);
    }
    return count;
  }

  async toCSV() {
    console.log('exporting to CSV');
    try {
      // prep transformation and upload streams
      const columns = this.config.CSV_EXPORT_ERROR_COLUMNS;
      const createRow = stringify({ header: true, columns });
      const { streamToS3, promise } = this.streamToS3(this.filename);

      // stream in images from MongoDB, write to transformation stream
      for await (const imgErr of ImageError.aggregate(this.pipeline)) {
        if (imgErr.error.includes('E11000')) imgErr.error = 'Duplicate image';
        imgErr.created = DateTime.fromJSDate(imgErr.created).toLocaleString(
          DateTime.DATETIME_MED_WITH_SECONDS,
        );
        createRow.write(imgErr);
      }

      createRow.end();

      // pipe together transform and write streams
      await stream.pipeline(createRow, streamToS3);

      // wait for upload complete
      await promise;
      console.log('upload complete');
    } catch (err) {
      throw new InternalServerError('error exporting to CSV: ' + (err as Error).message);
    }

    // get presigned url for new S3 object (expires in one hour)
    this.presignedURL = await this.getPresignedURL();

    return {
      url: this.presignedURL,
      count: this.errorCount,
      meta: {},
    };
  }

  async getPresignedURL() {
    console.log('getting presigned url');
    const command = new S3.GetObjectCommand({ Bucket: this.bucket, Key: this.filename });
    return await getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  streamToS3(filename: string) {
    // https://engineering.lusha.com/blog/upload-csv-from-large-data-table-to-s3-using-nodejs-stream/
    const pass = new PassThrough();
    const parallelUploadS3 = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: filename,
        Body: pass,
        ContentType: 'text/csv',
      },
    });

    return {
      streamToS3: pass,
      promise: parallelUploadS3.done(),
    };
  }
}

export default async function (
  task: TaskInput<ImageErrorTaskConfig> & { _id: string },
  config: Config,
) {
  const dataExport = new ImageErrorExport(
    {
      documentId: task._id,
      filters: task.config.filters,
      format: task.config.format,
    },
    config,
  );

  await dataExport.init();

  if (!task.config.format || task.config.format === 'csv') {
    return await dataExport.toCSV();
  } else {
    throw new Error(`Unsupported export format (${task.config.format})`);
  }
}

export interface ImageErrorTaskConfig {
  filters: any;
  format: string;
}

interface ImageErrorExportInput extends ImageErrorTaskConfig {
  documentId: string;
}
