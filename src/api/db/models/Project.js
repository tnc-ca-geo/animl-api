const { ApolloError } = require('apollo-server-errors');
const moment = require('moment');
const Project = require('../schemas/Project');

const generateProjectModel = ({ user } = {}) => ({

  // NEW
  getProjects: async (_ids) => {
    let query = {};
    if (user['is_superuser']) {
      console.log('ProjectModel.getProjects() - user is_superuser');
      query = _ids ? { _id: { $in: _ids } } : {};
    }
    else {
      const availIds = Object.keys(user['projects']);
      const filteredIds = _ids && _ids.filter((_id) => availIds.includes(_id));
      query = { _id: { $in: (filteredIds || availIds) }};
    }

    try {
      console.log(`ProjectModel.getProjects() - query: ${query}`);
      const projects = await Project.find(query);
      return projects;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // NEW
  createProject: async (input) => {
    console.log(`ProjectModel.createProject() - input: ${input}`);
    try {
      const newProject = new Project(input);
      await newProject.save();
      return newProject;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // NEW - add createCameraConfig()
  get createCameraConfig() {
    // if (!hasRole(user, ['animl_sci_project_owner', 'animl_superuser'])) {
    //   return null;
    // }
    return async ({ projectId, cameraSn }) => {
      try {
        console.log(`ProjectModel.createCameraConfig() - projectId: ${projectId}`);
        console.log(`ProjectModel.createCameraConfig() - cameraSn: ${cameraSn}`);
        let project = await this.getProjects(projectId);
        console.log(`ProjectModel.createCameraConfig() - found project: ${project}`);
        project = project[0];
        project.cameras.push({
          _id: cameraSn,
          deployments: [{
            name: 'default',
            description: 'This is the default deployment. It is not editable',
            editable: false,
          }],
        });
        await project.save();
        return project;
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },
 
  // NEW
  createView: async (input) => {
    console.log(`ProjectModel.createView() - input: ${input}`);
    try {
      // TODO AUTH - get project
      // do we want to accept project Id as a param? or pull it from user
      // user['curr_project'] here? 
      // decide on patern of determining what project we're acting on...
      // IF its an operation the superuser ever performs, we do not want to use
      // user['curr_project'], because they don't have one... 
      // unless we set it after we map the image to the correct project?
      let project = await this.getProjects(user['curr_project']);
      const newView = {
        name: input.name,
        filters: input.filters,
        ...(input.description && { description: input.description }),
        editable: input.editable,
      };
      project.views.push(newView)
      await project.save();
      return newView;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // NEW
  updateView: async (input, context) => {
    console.log(`ProjectModel.updateView() - input: ${input}`);
    try {
      let project = await this.getProjects(user['curr_project']);
      let view = project.views.find((view) => (
        view._id.toString() === input._id.toString()
      ));
      if (!view.editable) {
        throw new ApolloError(`View ${view.name} is not editable`);
      }
      for (let [key, newVal] of Object.entries(input.diffs)) {
        view[key] = newVal;
      }
      await project.save();
      return view;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // NEW
  deleteView: async (input, context) => {
    console.log(`ProjectModel.deleteView() - input: ${input}`);
    try {
      let project = await this.getProjects(user['curr_project']);
      let view = project.views.find((view) => (
        view._id.toString() === input._id.toString()
      ));
      if (!view.editable) {
        throw new ApolloError(`View ${view.name} is not editable`);
      }
      project.views = project.views.filter((view) => (
        view._id.toString() !== input._id.toString()
      ));
      return await project.save();
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // NEW
  reMapImagesToDeps: async (camConfig) => {
    console.log(`ProjectModel.reMapImagesToDeps() - camConfig: ${camConfig}`);
    try {
      // build array of operations from camConfig.deployments:
      // for each deployment, build filter, update, then perform bulkWrite
      let operations = [];
      for (const [index, dep] of camConfig.deployments.entries()) {
        const createdStart = dep.startDate || null;
        const createdEnd = camConfig.deployments[index + 1] 
          ? camConfig.deployments[index + 1].startDate
          : null;

        let filter = { cameraSn: camConfig._id };
        if (createdStart || createdEnd) {
          filter.dateTimeOriginal = {
            ...(createdStart && { $gte: createdStart }),
            ...(createdEnd && { $lt: createdEnd }),
          }
        }
        const update = { deployment: dep._id }
        operations.push({ updateMany: { filter, update } });
      };

      await Image.bulkWrite(operations);

    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // NEW
  get createDeployment() {
    return async (input, context) => {
      console.log(`ProjectModel.createDeployment() - input: ${input}`);
      const { cameraId, deployment } = input;
      try {
        let project = await this.getProjects(user['curr_project']);
        let camConfig = project.cameras.find((camConfig) => (
          camConfig._id.toString() ===  cameraId.toString()
        ));
        camConfig.deployments.push(deployment);
        await generateProjectModel.save();
        await this.reMapImagesToDeps(camConfig);
        return camConfig;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  // NEW
  get updateDeployment() {
    return async (input, context) => {
      console.log(`ProjectModel.updateDeployment() - input: ${input}`);
      const { cameraId, deploymentId, diffs } = input;
      try {
        let project = await this.getProjects(user['curr_project']);
        let camConfig = project.cameras.find((camConfig) => (
          camConfig._id.toString() ===  cameraId.toString()
        ));
        let deployment = camConfig.find((dep) => (
          dep._id.toString() === deploymentId.toString()
        ));
        if (deployment.name !== 'default') {
          for (let [key, newVal] of Object.entries(diffs)) {
            deployment[key] = newVal;
          }
          await project.save();
          if (Object.keys(diffs).includes('startDate')) {
            await this.reMapImagesToDeps(camConfig);
          }
        }
        return camera;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  // NEW
  get deleteDeployment() {
    return async (input, context) => {
      console.log(`ProjectModel.deleteDeployment() - input: ${input}`);
      const { cameraId, deploymentId } = input;
      try {
        let project = await this.getProjects(user['curr_project']);
        let camConfig = project.cameras.find((camConfig) => (
          camConfig._id.toString() ===  cameraId.toString()
        ));
        camConfig.deployments = camConfig.deployments.filter((dep) => (
          dep._id.toString() !== deploymentId.toString()
        ));
        await project.save();
        await this.reMapImagesToDeps(camConfig);
        return camConfig;
      } catch (err) {
        throw new ApolloError(err);
      }
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
