import { Context } from '../handler.js';
import type { ImageSchema } from '../db/schemas/Image.js';
import { buildImgUrl } from '../db/models/utils.js';

export default {
  Image: {
    signedImageUrl: async (parent: ImageSchema, _: unknown, context: Context) => ({
      url: buildImgUrl(parent, context.config, 'original'),
      thumbUrl: buildImgUrl(parent, context.config, 'small'),
    }),
  },
};
