import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default class Signer {
  static async getSignedUrl(s3, command, opts) {
    return await getSignedUrl(s3, command, opts);
  }
}
