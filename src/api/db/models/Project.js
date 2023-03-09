const { ApolloError, ForbiddenError } = require('apollo-server-errors');
const { DateTime } = require('luxon');
const Project = require('../schemas/Project');
const Image = require('../schemas/Image');
const { sortDeps, hasRole, idMatch } = require('./utils');
const retry = require('async-retry');
const {
  WRITE_DEPLOYMENTS_ROLES,
  WRITE_VIEWS_ROLES
} = require('../../auth/roles');

const generateProjectModel = ({ user } = {}) => ({

  getProjects: async (_ids) => {
    let query = {};
    if (user['is_superuser']) {
      query = _ids ? { _id: { $in: _ids } } : {};
    }
    else {
      const availIds = Object.keys(user['projects']);
      const filteredIds = _ids && _ids.filter((_id) => availIds.includes(_id));
      query = { _id: { $in: (filteredIds || availIds) } };
    }

    try {
      const projects = await Project.find(query);
      return projects;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  },

  createProject: async (input) => {
    const operation = async (input) => {
      return await retry(async () => {
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
        return await retry(async () => {

          const [project] = await this.getProjects([projectId]);

          // make sure project doesn't already have a config for this cam
          const currCamConfig = project.cameraConfigs.find((c) => c._id === cameraId);
          if (!currCamConfig) {
            project.cameraConfigs.push({
              _id: cameraId,
              deployments: [{
                name: 'default',
                timezone: project.timezone,
                description: 'This is the default deployment. It is not editable',
                editable: false
              }]
            });
            await project.save();
          }
          return project;

        }, { retries: 2 });
      };

      try {
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

      const operation = async (input) => {
        return await retry(async () => {

          // find project, add new view, and save
          const [project] = await this.getProjects([user['curr_project']]);
          const newView = {
            name: input.name,
            filters: input.filters,
            ...(input.description && { description: input.description }),
            editable: input.editable
          };
          project.views.push(newView);
          const updatedProj = await project.save();
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
    };
  },

  get updateView() {
    if (!hasRole(user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async ({ viewId, diffs }) => {
        return await retry(async (bail) => {
          // find view
          const [project] = await this.getProjects([user['curr_project']]);
          const view = project.views.find((v) => idMatch(v._id, viewId));
          if (!view.editable) {
            bail(new ForbiddenError(`View ${view.name} is not editable`));
          }

          // appy updates & save project
          for (const [key, newVal] of Object.entries(diffs)) {
            view[key] = newVal;
          }
          const updatedProj = await project.save();
          return updatedProj.views.find((v) => idMatch(v._id, viewId));

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get deleteView() {
    if (!hasRole(user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async ({ viewId }) => {
        return await retry(async (bail) => {

          // find view
          const [project] = await this.getProjects([user['curr_project']]);
          const view = project.views.find((v) => idMatch(v._id, viewId));
          if (!view.editable) {
            bail(new ForbiddenError(`View ${view.name} is not editable`));
          }

          // remove view from project and save
          project.views = project.views.filter((v) => !idMatch(v._id, viewId));
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
    };
  },

  reMapImagesToDeps: async ({ projId, camConfig }) => {

    const operation = async ({ projId, camConfig }) => {
      return await retry(async () => {
        // build array of operations from camConfig.deployments:
        // for each deployment, build filter, build update, then perform bulkWrite
        // NOTE: this function expects deps to be in chronological order!
        const operations = [];
        for (const [index, dep] of camConfig.deployments.entries()) {
          const createdStart = dep.startDate || null;
          const createdEnd = camConfig.deployments[index + 1]
            ? camConfig.deployments[index + 1].startDate
            : null;

          const filter = { projectId: projId, cameraId: camConfig._id };
          if (createdStart || createdEnd) {
            filter.dateTimeOriginal = {
              ...(createdStart && { $gte: createdStart }),
              ...(createdEnd && { $lt: createdEnd })
            };
          }

          const imgs = await Image.find(filter);
          for (const img of imgs) {

            const update = {};
            if (img.deploymentId.toString() !== dep._id.toString()) {
              update.deploymentId = dep._id;
            }

            if (img.timezone !== dep.timezone) {
              const dtOriginal = DateTime.fromJSDate(img.dateTimeOriginal).setZone(img.timezone);
              const newDT = dtOriginal.setZone(dep.timezone, { keepLocalTime: true });
              update.dateTimeOriginal = newDT;
              update.timezone = dep.timezone;
            }

            if (Object.entries(update).length > 0) {
              const op = {
                updateOne: { filter: { _id: img._id }, update }
              };
              operations.push(op);
            }
          }
        }
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

      const operation = async ({ cameraId, deployment }) => {
        return await retry(async () => {

          // find camera config
          const [project] = await this.getProjects([user['curr_project']]);
          const camConfig = project.cameraConfigs.find((cc) => (
            idMatch(cc._id, cameraId)
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
        // TODO: we need to reverse the above operation if reMapImagesToDeps fails!
        await this.reMapImagesToDeps({ projId: project._id, camConfig });
        return camConfig;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get updateDeployment() {
    if (!hasRole(user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async ({ cameraId, deploymentId, diffs }) => {
        return await retry(async (bail) => {

          // find deployment
          const [project] = await this.getProjects([user['curr_project']]);
          const camConfig = project.cameraConfigs.find((cc) => (
            idMatch(cc._id, cameraId)
          ));
          const deployment = camConfig.deployments.find((dep) => (
            idMatch(dep._id, deploymentId)
          ));
          if (deployment.name === 'default') {
            bail(new ForbiddenError(`View ${deployment.name} is not editable`));
          }

          // apply updates, sort deployments, and save project
          for (const [key, newVal] of Object.entries(diffs)) {
            deployment[key] = newVal;
          }
          camConfig.deployments = sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };

        }, { retries: 2 });
      };

      try {
        const { project, camConfig } = await operation(input);
        // TODO: we need to reverse the above operation if reMapImagesToDeps fails!
        if (Object.keys(input.diffs).includes('startDate')) {
          await this.reMapImagesToDeps({ projId: project._id, camConfig });
        }
        return camConfig;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  },

  get deleteDeployment() {
    if (!hasRole(user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return async (input) => {

      const operation = async ({ cameraId, deploymentId }) => {
        return await retry(async () => {

          // find camera config
          const [project] = await this.getProjects([user['curr_project']]);
          const camConfig = project.cameraConfigs.find((cc) => (
            idMatch(cc._id, cameraId)
          ));

          // filter out deployment, sort remaining ones, and save project
          camConfig.deployments = camConfig.deployments.filter((dep) => (
            !idMatch(dep._id, deploymentId)
          ));
          camConfig.deployments = sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };

        }, { retries: 2 });
      };

      try {
        const { project, camConfig } = await operation(input);
        // TODO: we need to reverse the above operation if reMapImagesToDeps fails!
        await this.reMapImagesToDeps({ projId: project._id, camConfig });
        return camConfig;
      } catch (err) {
        // if error is uncontrolled, throw new ApolloError
        if (err instanceof ApolloError) throw err;
        throw new ApolloError(err);
      }
    };
  }

});

module.exports = generateProjectModel;
