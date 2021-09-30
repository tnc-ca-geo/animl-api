const { ApolloError } = require('apollo-server-errors');
const moment = require('moment');
const View = require('../schemas/View');
const Model = require('../schemas/Model');

const generateViewModel = ({ user } = {}) => ({

  createView: async (input) => {
    try {
      const newView = new View(input);
      await newView.save();
      return newView;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  getViews: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const views = await View.find(query);
      return views;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  updateView: async (input) => {
    try {
      const views = await View.find({ _id: input._id });
      const view = views[0];
      if (!view.editable) {
        throw new ApolloError(`View ${view.name} is not editable`);
      }
      for (let [key, newVal] of Object.entries(input.diffs)) {
        view[key] = newVal;
      }
      await view.save();
      return view;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  deleteView: async (input) => {
    try {
      const views = await View.find({ _id: input._id });
      if (!views[0].editable) {
        throw new ApolloError(`View ${view.name} is not editable`);
      }
      return await View.deleteOne({ _id: input._id });
    } catch (err) {
      throw new ApolloError(err);
    }
  },

 });

module.exports = generateViewModel;



// TODO: pass user into model generators to perform authorization at the
// data fetching level. e.g.:
// export const generateViewModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
