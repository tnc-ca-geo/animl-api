const Model = require('../schemas/Model');

const generateModelModel = () => ({

  getModels: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const models = await Model.find(query);
      return models;
    } catch (err) {
      throw new Error(err);
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
