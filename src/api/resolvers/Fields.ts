import { Context } from '../handler.js';
import type { ImageSchema } from '../db/schemas/Image.js';
import { buildImgUrl } from '../db/models/utils.js';

export default {
  Image: {
    url: (parent: ImageSchema, _: unknown, context: Context) =>
      Object.fromEntries(
        ['original', 'medium', 'small'].map((size) => [
          size,
          buildImgUrl(parent, context.config, size),
        ]),
      ),
  },
};
