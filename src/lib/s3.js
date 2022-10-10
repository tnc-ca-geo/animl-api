import AWS from 'aws-sdk';
import { Err } from '@openaddresses/batch-schema';

/**
 * @class
 */
export default class S3 {
  constructor(key) {
    this.key = key;
  }

  async get() {
    const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
    let res;

    try {
      if (!process.env.BUCKET) throw new Err(400, null, 'BUCKET not set');

      res = await s3.getObject({
        Bucket: process.env.BUCKET,
        Key: this.key
      }).promise();
    } catch (err) {
      throw new Err(500, new Error(err), 'Failed to retrieve file');
    }

    try {
      return JSON.parse(res.Body);
    } catch (err) {
      return res.Body;
    }
  }

  async put(stream, params = {}) {
    try {
      if (!process.env.BUCKET) throw new Err(400, null, 'BUCKET not set');

      const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
      await s3.upload({
        Bucket: process.env.BUCKET,
        Key: this.key,
        Body: stream,
        ...params
      }).promise();
    } catch (err) {
      throw new Err(500, new Error(err), 'Failed to upload file');
    }
  }

  static async exists(key) {
    try {
      if (!process.env.BUCKET) throw new Err(400, null, 'BUCKET not set');

      const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
      await s3.headObject({
        Bucket: process.env.BUCKET,
        Key: key
      }).promise();
      return true;
    } catch (err) {
      if (err.code === 'NotFound') return false;

      throw new Err(500, new Error(err), 'Failed to determine existance');
    }
  }

  static async list(fragment) {
    try {
      if (!process.env.BUCKET) throw new Err(400, null, 'BUCKET not set');

      const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
      const list = await s3.listObjectsV2({
        Bucket: process.env.BUCKET,
        Prefix: fragment
      }).promise();

      return list.Contents;
    } catch (err) {
      throw new Err(500, new Error(err), 'Failed to list files');
    }
  }

  static async del(key) {
    if (!process.env.BUCKET) return;

    try {
      const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
      await s3.deleteObject({
        Bucket: process.env.BUCKET,
        Key: key
      }).promise();
    } catch (err) {
      throw new Err(500, new Error(err), 'Failed to delete file');
    }
  }

  stream(res, name) {
    const s3 = new AWS.S3({ region: process.env.AWS_DEFAULT_REGION });
    const s3request = s3.getObject({
      Bucket: process.env.BUCKET,
      Key: this.key
    });
    const s3stream = s3request.createReadStream();

    s3request.on('httpHeaders', (statusCode, headers) => {
      headers['Content-disposition'] = `inline; filename="${name}"`;

      res.writeHead(statusCode, headers);
    });

    s3stream.on('error', (err) => {
      // Could not find object, ignore
      console.error(err);
    });

    s3stream.pipe(res);
  }
}
