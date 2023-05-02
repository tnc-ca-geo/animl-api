const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { WRITE_IMAGES_ROLES } = require('../../auth/roles');
const ImageError = require('../schemas/ImageError');
const retry = require('async-retry');
const utils = require('./utils');
const { randomUUID } = require('node:crypto');

const generateImageErrorModel = ({ user } = {}) => ({
  get createError() {
    if (!utils.hasRole(user, WRITE_IMAGES_ROLES)) throw new ForbiddenError;

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
          _id: randomUUID(),
          image: input.image,
          batch: input.batch,
          error: input.error,
          created: new Date()
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
  }
});

module.exports = generateImageErrorModel;
