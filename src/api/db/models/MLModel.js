const { ApolloError } = require('apollo-server-errors');
const MLModel = require('../schemas/MLModel');
const utils = require('./utils');

const generateMLModelModel = ({ user } = {}) => ({

  getMLModels: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const mlModels = await MLModel.find(query);
      return mlModels;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  createMLModel: async (mlModel) => {
    // if (!hasRole(user, ['animl_superuser'])) {
    //   return null;
    // }
    console.log(`Creating new ml model record for  - ${mlModel.name}`);
    try {
      const newModel = new MLModel({
        name: mlModel.name,
        version: mlModel.version,
        ...(mlModel.description && { description: mlModel.description }),
        ...(mlModel.renderThreshold && { renderThreshold: mlModel.renderThreshold }),
        ...(mlModel.categories && { categories: mlModel.categories }),
      });
      await newModel.save();
      return newModel;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

 });

 module.exports = generateMLModelModel;

// TODO: pass user into model generators to perform authorization at the
// data fetching level. e.g.:
// export const generateCameraModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
