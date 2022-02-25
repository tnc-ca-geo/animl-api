const { ApolloError } = require('apollo-server-errors');
const moment = require('moment');
const Project = require('../schemas/Project');
const Image = require('../schemas/Image');
const utils = require('./utils');


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
        const projects = await this.getProjects(projectId);
        const project = projects[0];
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
  get createView() {
    // if (!hasRole(user, ['animl_sci_project_owner', 'animl_superuser'])) {
    //   return null;
    // }
    return async (input) => {
      console.log(`ProjectModel.createView() - input: ${input}`);
      try {
        // TODO AUTH - get project
        // do we want to accept project Id as a param? or pull it from user
        // user['curr_project'] here? 
        // decide on patern of determining what project we're acting on...
        // IF its an operation the superuser ever performs, we do not want to use
        // user['curr_project'], because they don't have one... 
        // unless we set it after we map the image to the correct project?
        const projects = await this.getProjects(user['curr_project']);
        const project = projects[0];
        console.log(`ProjectModel.createView() - project: `, project);
        const newView = {
          name: input.name,
          filters: input.filters,
          ...(input.description && { description: input.description }),
          editable: input.editable,
        };
        project.views.push(newView)
        const updatedProj = await project.save();
        // TODO AUTH - do we want to create _id for views on front end and pass
        // them in as inputs to createView (like we do for objects and labels)?
        // that would save us this step. related to question of whether we need 
        // to return updated documents to the front end at all... 
        return updatedProj.views.find((v) => v.name === newView.name);
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  // NEW
  get updateView() {
    return async (input, context) => {
      console.log(`ProjectModel.updateView() - input: ${input}`);
      try {
        const projects = await this.getProjects(user['curr_project']);
        const project = projects[0];
        let view = project.views.find((view) => (
          view._id.toString() === input._id.toString()
        ));
        if (!view.editable) {
          throw new ApolloError(`View ${view.name} is not editable`);
        }
        for (let [key, newVal] of Object.entries(input.diffs)) {
          view[key] = newVal;
        }
        const updatedProj = await project.save();
        return updatedProj.views.find((v) => (
          v._id.toString() === input._id.toString()
        ));
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  // NEW
  get deleteView() {
    return async (input, context) => {
      console.log(`ProjectModel.deleteView() - input: ${input}`);
      try {
        const projects = await this.getProjects(user['curr_project']);
        const project = projects[0];
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
    }
  },

  // NEW
  reMapImagesToDeps: async ({ projId, camConfig }) => {
    console.log(`ProjectModel.reMapImagesToDeps() - projId: ${projId}`);
    console.log(`ProjectModel.reMapImagesToDeps() - camConfig: ${camConfig}`);
    try {
      // build array of operations from camConfig.deployments:
      // for each deployment, build filter, update, then perform bulkWrite
      // NOTE: this function expects deps to be in chronological order!
      let operations = [];
      for (const [index, dep] of camConfig.deployments.entries()) {
        const createdStart = dep.startDate || null;
        const createdEnd = camConfig.deployments[index + 1] 
          ? camConfig.deployments[index + 1].startDate
          : null;

        let filter = { project: projId, cameraSn: camConfig._id };
        if (createdStart || createdEnd) { 
          filter.dateTimeOriginal = {
            ...(createdStart && { $gte: createdStart }),
            ...(createdEnd && { $lt: createdEnd }),
          }
        }
        const update = { deployment: dep._id, timezone: dep.timezone };
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
        const projects = await this.getProjects(user['curr_project']);
        const project = projects[0];
        let camConfig = project.cameras.find((camConfig) => (
          camConfig._id.toString() ===  cameraId.toString()
        ));
        camConfig.deployments.push(deployment);
        camConfig.deployments = utils.sortDeps(camConfig.deployments);
        await project.save();
        await this.reMapImagesToDeps({ projId: project._id, camConfig });
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
        const projects = await this.getProjects(user['curr_project']);
        const project = projects[0];
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
          camConfig.deployments = utils.sortDeps(camConfig.deployments);
          await project.save();
          if (Object.keys(diffs).includes('startDate')) {
            await this.reMapImagesToDeps({ projId: project._id, camConfig });
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
        const projects = await this.getProjects(user['curr_project']);
        const project = projects[0];
        let camConfig = project.cameras.find((camConfig) => (
          camConfig._id.toString() ===  cameraId.toString()
        ));
        camConfig.deployments = camConfig.deployments.filter((dep) => (
          dep._id.toString() !== deploymentId.toString()
        ));
        camConfig.deployments = utils.sortDeps(camConfig.deployments);
        await project.save();
        await this.reMapImagesToDeps({ projId: project._id, camConfig });
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
