const { ApolloError } = require('apollo-server-errors');
const Model = require('../schemas/Model');
const utils = require('./utils');

const generateModelModel = ({ user } = {}) => ({

  getModels: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const models = await Model.find(query);
      return models;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  createModel: async (model) => {
    // if (!hasRole(user, ['animl_superuser'])) {
    //   return null;
    // }
    console.log(`Creating new ml model record for  - ${model.name}`);
    try {
      const newModel = new Model({
        name: model.name,
        version: model.version,
        ...(model.description && { description: model.description }),
        ...(model.renderThreshold && { renderThreshold: model.renderThreshold }),
        ...(model.categories && { categories: model.categories }),
      });
      await newModel.save();
      return newModel;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

 });

 module.exports = generateModelModel;

// TODO: pass user into model generators to perform authorization at the
// data fetching level. e.g.:
// export const generateCameraModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
