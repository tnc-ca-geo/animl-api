import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { WRITE_IMAGES_ROLES } from '../../auth/roles.js';
import { ImageError } from '../schemas/ImageError.js';
import retry from 'async-retry';
import { hasRole } from './utils.js';

const generateImageErrorModel = ({ user } = {}) => ({
  get createError() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
      const operation = async (input) => {
        return await retry(async () => {
          const newImageError = new ImageError(input);
          await newImageError.save();
          return newImageError;
        }, { retries: 2 });
      };

      try {
        const imageerr = await operation({
          image: input.image,
          batch: input.batch,
          error: input.error
        });

        return {
          _id: imageerr._id,
          image: imageerr.image,
          batch: imageerr.batch,
          error: imageerr.error,
          created: imageerr.created
        };
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get clearErrors() {
    if (!hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

    return async (input) => {
      const operation = async (input) => {
        return await retry(async () => {
          return await ImageError.deleteMany(input);
        }, { retries: 2 });
      };

      try {
        await operation({
          batch: input.batch
        });

        return { message: 'Cleared' };
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  }
});

export default generateImageErrorModel;
