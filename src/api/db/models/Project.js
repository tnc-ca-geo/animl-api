const { ApolloError } = require('apollo-server-errors');
const moment = require('moment');
const Project = require('../schemas/Project');

const generateProjectModel = ({ user } = {}) => ({

  createProject: async (input) => {
    try {
      const newProject = new Project(input);
      await newProject.save();
      return newView;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  getProjects: async (_ids) => {
    const query = _ids ? { _id: { $in: _ids } } : {};
    try {
      const projects = await Project.find(query);
      return projects;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

 });

module.exports = generateProjectModel;



// TODO: pass user into model generators to perform authorization at the
// data fetching level. e.g.:
// export const generateViewModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
