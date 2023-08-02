import stream from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import { Upload } from '@aws-sdk/lib-storage';
import S3 from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApolloError } from 'apollo-server-lambda';
import { stringify } from 'csv-stringify';
import { ImageError } from '../api/db/schemas/ImageError.js';

export default class ImageExport {
  constructor({ documentId, filters, format }, config) {
    this.config = config;
    this.s3 = new S3.S3Client({ region: process.env.AWS_DEFAULT_REGION });
    this.ext = '.csv';
    this.documentId = documentId;
    this.filename = `${documentId}_${format}${this.ext}`;
    this.bucket = config['/EXPORTS/EXPORTED_DATA_BUCKET'];
    this.errorCount = 0;
    this.imageCountThreshold = 18000;  // TODO: Move to config?
    this.pipeline = [
      { $match: { 'batch':  filters.batch } }
    ];

    this.status = 'Pending';
    this.errs = [];
  }

  async init() {
    console.log('initializing Export');
    try {
      this.errorCount = await this.getCount(this.pipeline);
      console.log('errorCount: ', this.errorCount);

    } catch (err) {
      await this.error(err);
      throw new ApolloError('error initializing the export class');
    }
  }

  async getCount(pipeline) {
    console.log('getting error count');
    let count = null;
    try {
      pipeline = JSON.parse(JSON.stringify(pipeline));
      pipeline.push({ $count: 'count' });

      const res = await ImageError.aggregate(pipeline);
      console.log('res: ', res);
      count = res[0] ? res[0].count : 0;
    } catch (err) {
      await this.error(err);
      throw new ApolloError('error counting ImageError');
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
        createRow.write(imgErr);
      }

      createRow.end();

      // pipe together transform and write streams
      await stream.pipeline(
        createRow,
        streamToS3
      );

      // wait for upload complete
      await promise;
      console.log('upload complete');
    } catch (err) {
      await this.error(err);
      throw new ApolloError('error exporting to CSV');
    }

    // get presigned url for new S3 object (expires in one hour)
    this.presignedURL = await this.getPresignedURL();
  }

  async success() {
    console.log('export success');
    this.status = 'Success';
    await this.updateStatus();
  }

  async error(message) {
    console.log('export error');
    this.errs.push(message);
    this.status = 'Error';
    await this.updateStatus();
  }

  async updateStatus() {
    console.log(`updating ${this.documentId}.json status document`);
    // TODO: make sure the status document exists first
    try {
      console.log(`s3://${this.bucket}/${this.documentId}.json`);

      const res = await this.s3.send(new S3.PutObjectCommand({
        Bucket: this.bucket,
        Key: `${this.documentId}.json`,
        Body: JSON.stringify({
          status: this.status,
          error: this.errs,
          url: this.presignedURL,
          count: this.errorCount,
          meta: {}
        }),
        ContentType: 'application/json; charset=utf-8'
      }));
      console.log('document updated: ', res);
    } catch (err) {
      throw new ApolloError('error updating status document');
    }
  }

  async getPresignedURL() {
    console.log('getting presigned url');
    const command = new S3.GetObjectCommand({ Bucket: this.bucket, Key: this.filename });
    return await getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  streamToS3(filename) {
    // https://engineering.lusha.com/blog/upload-csv-from-large-data-table-to-s3-using-nodejs-stream/
    const pass = new PassThrough();
    const parallelUploadS3 = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: filename,
        Body: pass,
        ContentType: 'text/csv'
      }
    });

    return {
      streamToS3: pass,
      promise: parallelUploadS3.done()
    };
  }
}
