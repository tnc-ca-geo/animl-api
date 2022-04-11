const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const Project = require('../schemas/Project');
const Image = require('../schemas/Image');
const { sortDeps, hasRole } = require('./utils');
const retry = require('async-retry');
const {
  WRITE_DEPLOYMENTS_ROLES,
  WRITE_VIEWS_ROLES
} = require('../../auth/roles');


const generateProjectModel = ({ user } = {}) => ({

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
      console.log(`ProjectModel.getProjects() - query: ${JSON.stringify(query)}`);
      const projects = await Project.find(query);
      return projects;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  createProject: async (input) => {
    console.log(`ProjectModel.createProject() - input: ${input}`);
    const operation = async (input) => {
      return await retry(async (bail) => {
        const newProject = new Project(input);
        await newProject.save();
        return newProject;
      }, { retries: 2 });
    };
    
    try {
      return await operation(input);
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  get createCameraConfig() {
    return async (projectId, cameraId) => {
      
      const operation = async (projectId, cameraId) => {
        return await retry(async (bail) => {

          const [project] = await this.getProjects([projectId]);
          console.log(`ProjectModel.createCameraConfig() - found project: ${project}`);
          
          // make sure project doesn't already have a config for this cam
          const currCamConfig = project.cameraConfigs.find((c) => c._id === cameraId);
          if (!currCamConfig) {
            project.cameraConfigs.push({
              _id: cameraId,
              deployments: [{
                name: 'default',
                timezone: project.timezone,
                description: 'This is the default deployment. It is not editable',
                editable: false,
              }],
            });
            await project.save();
            console.log(`ProjectModel.createCameraConfig() - saved project: ${project}`);
          }
          return project;

        }, { retries: 2 });
      };

      try {
        console.log(`ProjectModel.createCameraConfig() - projectId: ${projectId}`);
        console.log(`ProjectModel.createCameraConfig() - cameraId: ${cameraId}`);
        return await operation(projectId, cameraId);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },
 
  get createView() {
    if (!hasRole(user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ProjectModel.createView() - input: ${input}`);

      const operation = async (input) => {
        return await retry(async (bail) => {

          // find project, add new view, and save
          const [project] = await this.getProjects([user['curr_project']]);
          console.log(`ProjectModel.createView() - project: `, project);
          const newView = {
            name: input.name,
            filters: input.filters,
            ...(input.description && { description: input.description }),
            editable: input.editable,
          };
          project.views.push(newView)
          const updatedProj = await project.save();
          console.log(`ProjectModel.createView() - newView: `, newView); 
          return updatedProj.views.find((v) => v.name === newView.name);

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get updateView() {
    if (!hasRole(user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ProjectModel.updateView() - input: ${input}`);

      const operation = async ({ _id, diffs }) => {
        return await retry(async (bail) => {
          // find view
          const [project] = await this.getProjects([user['curr_project']]);
          let view = project.views.find((view) => (
            view._id.toString() === _id.toString()
          ));
          if (!view.editable) {
            bail(new ForbiddenError(`View ${view.name} is not editable`));
          }

          // appy updates & save project
          for (let [key, newVal] of Object.entries(diffs)) {
            view[key] = newVal;
          }
          const updatedProj = await project.save();
          return updatedProj.views.find((v) => (
            v._id.toString() === _id.toString()
          ));

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get deleteView() {
    if (!hasRole(user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ProjectModel.deleteView() - input: ${input}`);

      const operation = async ({ _id }) => {
        return await retry(async (bail) => {

          // find view
          const [project] = await this.getProjects([user['curr_project']]);
          let view = project.views.find((view) => (
            view._id.toString() === _id.toString()
          ));
          if (!view.editable) {
            bail(new ForbiddenError(`View ${view.name} is not editable`));
          }

          // remove view from project and save
          project.views = project.views.filter((view) => (
            view._id.toString() !== _id.toString()
          ));
          return await project.save();

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  reMapImagesToDeps: async ({ projId, camConfig }) => {
    console.log(`ProjectModel.reMapImagesToDeps() - projId: ${projId}`);
    console.log(`ProjectModel.reMapImagesToDeps() - camConfig: ${camConfig}`);

    const operation = async ({ projId, camConfig }) => {
      return await retry(async (bail) => {
        // build array of operations from camConfig.deployments:
        // for each deployment, build filter, update, then perform bulkWrite
        // NOTE: this function expects deps to be in chronological order!
        let operations = [];
        for (const [index, dep] of camConfig.deployments.entries()) {
          const createdStart = dep.startDate || null;
          const createdEnd = camConfig.deployments[index + 1] 
            ? camConfig.deployments[index + 1].startDate
            : null;

          let filter = { project: projId, cameraId: camConfig._id };
          if (createdStart || createdEnd) {
            filter.dateTimeOriginal = {
              ...(createdStart && { $gte: createdStart }),
              ...(createdEnd && { $lt: createdEnd }),
            }
          }
          // TODO TIME - decide if we're storing timezone on images or 
          // converting to UTC+0 and storing that. 
          // converting to UTC+0 would be ideal but require pulling all matching
          // images into memory, iterating through them to convert and save to 
          // UTC+0 (maybe with aggregation pipeline + updatemany?) and performoing
          // update many / bulk write
          const update = {
            deployment: dep._id,
            // timezone: dep.timezone 
          };
          operations.push({ updateMany: { filter, update } });
        };

        await Image.bulkWrite(operations);
      }, { retries: 3 });
    };

    try {
      await operation({ projId, camConfig });
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  get createDeployment() {
    if (!hasRole(user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ProjectModel.createDeployment() - deployment: ${JSON.stringify(input)}`);

      const operation = async ({ cameraId, deployment }) => {
        return await retry(async (bail) => {

          // find camera config
          const [project] = await this.getProjects([user['curr_project']]);
          let camConfig = project.cameraConfigs.find((camConfig) => (
            camConfig._id.toString() === cameraId.toString()
          ));

          // add new deployment, sort them, and save project
          camConfig.deployments.push(deployment);
          camConfig.deployments = sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };

        }, { retries: 2 });
      };

      try {
        const { project, camConfig } = await operation(input);
        await this.reMapImagesToDeps({ projId: project._id, camConfig });
        return camConfig;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get updateDeployment() {
    if (!hasRole(user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ProjectModel.updateDeployment() - input: ${JSON.stringify(input)}`);

      const operation = async ({ cameraId, deploymentId, diffs }) => {
        return await retry(async (bail) => {

          // find deployment
          const [project] = await this.getProjects([user['curr_project']]);
          let camConfig = project.cameraConfigs.find((camConfig) => (
            camConfig._id.toString() ===  cameraId.toString()
          ));
          let deployment = camConfig.deployments.find((dep) => (
            dep._id.toString() === deploymentId.toString()
          ));
          if (deployment.name === 'default') {
            bail(new ForbiddenError(`View ${view.name} is not editable`));
          }

          // apply updates, sort deployments, and save project
          for (let [key, newVal] of Object.entries(diffs)) {
            deployment[key] = newVal;
          }
          camConfig.deployments = sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };

        }, { retries: 2 });
      };

      try {
        const { project, camConfig } = await operation(input);
        if (Object.keys(input.diffs).includes('startDate')) {
          await this.reMapImagesToDeps({ projId: project._id, camConfig });
        }
        return camConfig;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

  get deleteDeployment() {
    if (!hasRole(user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return async (input) => {
      console.log(`ProjectModel.deleteDeployment() - input: ${JSON.stringify(input)}`);

      const operation = async ({ cameraId, deploymentId }) => {
        return await retry(async (bail) => {

          // find camera config
          const [project] = await this.getProjects([user['curr_project']]);
          let camConfig = project.cameraConfigs.find((camConfig) => (
            camConfig._id.toString() ===  cameraId.toString()
          ));
          
          // filter out deployment, sort remaining ones, and save project
          camConfig.deployments = camConfig.deployments.filter((dep) => (
            dep._id.toString() !== deploymentId.toString()
          ));
          camConfig.deployments = sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };

        }, { retries: 2 });
      };
      
      try {
        const { project, camConfig } = await operation(input);
        await this.reMapImagesToDeps({ projId: project._id, camConfig });
        return camConfig;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    }
  },

 });

module.exports = generateProjectModel;
