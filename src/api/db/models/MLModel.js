const { ApolloError } = require('apollo-server-errors');
const MLModel = require('../schemas/MLModel');
const utils = require('./utils');

const generateMLModelModel = ({ user } = {}) => ({

  getMLModels: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    console.log(`MLModel.getMLModels() - query: ${query}`);
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
    try {
      const newModel = new MLModel({
        name: mlModel.name,
        version: mlModel.version,
        ...(mlModel.description && { description: mlModel.description }),
        ...(mlModel.renderThreshold && { renderThreshold: mlModel.renderThreshold }),
        ...(mlModel.categories && { categories: mlModel.categories }),
      });
      console.log(`MLModel.createModel() - newModel: ${newModel}`);
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
