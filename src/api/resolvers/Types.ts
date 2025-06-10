import { Context } from '../handler.js';
import type { ImageSchema } from '../db/schemas/Image.js';
import { buildImgUrl, signUrl } from '../db/models/utils.js';

export default {
  Image: {
    signedImageUrl: async (parent: ImageSchema, _: unknown, context: Context) => {
      const config = await context.config;
      const privateKey = config[`/IMAGES/CLOUDFRONT_DISTRIBUTION_PRIVATEKEY`];
      return {
        url: signUrl(buildImgUrl(parent, config, 'original'), privateKey),
        thumbUrl: signUrl(buildImgUrl(parent, config, 'small'), privateKey),
      };
    },
  },
};
