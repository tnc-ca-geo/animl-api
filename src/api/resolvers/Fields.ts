import { Context } from '../handler.js';
import type { ImageSchema } from '../db/schemas/Image.js';
import { buildImgUrl } from '../db/models/utils.js';

// Field level resolvers
// NOTE: For more information on resolver chains and when to use field-level resolvers, see:
// https://www.apollographql.com/docs/apollo-server/data/resolvers/#resolver-chains

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
