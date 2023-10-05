import mongoose from 'mongoose';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { DateTime } from 'luxon';
import Project from '../schemas/Project.js';
import { UserModel } from './User.js';
import Image from '../schemas/Image.js';
import { sortDeps, hasRole, idMatch } from './utils.js';
import retry from 'async-retry';
import {
  WRITE_DEPLOYMENTS_ROLES,
  WRITE_VIEWS_ROLES,
  WRITE_AUTOMATION_RULES_ROLES
} from '../../auth/roles.js';

export class ProjectModel {
  static async getProjects(input, context) {
    console.log('Project.getProjects - input: ', input);
    let query = {};
    if (context.user['is_superuser']) {
      query = input?._ids ? { _id: { $in: input._ids } } : {};
    }
    else {
      const availIds = Object.keys(context.user['projects']);
      const filteredIds = input?._ids && input._ids.filter((_id) => availIds.includes(_id));
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
  }

  static async createProject(input, context) {
    const operation = async (input) => {
      return await retry(async () => {
        const newProject = new Project(input);
        await newProject.save();
        return newProject;
      }, { retries: 2 });
    };

    if (!context.user['cognito:username']) {
      // If projects are created by a "machine" user they will end up orphaned
      // in that no users will have permission to see the project
      throw new Error('Projects must be created by an authenticated user');
    }

    try {
      const _id = input.name.toLowerCase().replace(/\s/g, '_').replace(/[^0-9a-z_]/gi, '');
      const project = await operation({
        ...input,
        _id,
        views: [{
          name: 'All images',
          filters: {},
          description: 'Default view of all images. This view is not editable.',
          editable: false
        }],
        availableMLModels: ['megadetector_v5a', 'megadetector_v5b', 'mirav2']
      });

      await UserModel.createGroups({ name: _id }, context);

      context.user['curr_project'] = _id;

      await UserModel.update({
        username: context.user['cognito:username'],
        roles: ['manager']
      }, context);

      return project;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createCameraConfig(input, context) {
    console.log('Project.createCameraConfig - input: ', input);
    const operation = async ({ projectId, cameraId }, context) => {
      return await retry(async () => {
        const [project] = await ProjectModel.getProjects({ _ids: [projectId] }, context);
        console.log('originalProject: ', project);

        const newCamConfig = {
          _id: cameraId,
          deployments: [{
            _id: new mongoose.Types.ObjectId(),
            name: 'default',
            timezone: project.timezone,
            description: 'This is the default deployment. It is not editable',
            editable: false
          }]
        };

        // NOTE: using findOneAndUpdate() with an aggregation pipeline to update
        // Projects to preserve atomicity of the operation and avoid race conditions
        // during bulk upload image ingestion.
        // https://github.com/tnc-ca-geo/animl-api/issues/112
        const updatedProject = await Project.findOneAndUpdate(
          { _id: projectId },
          [
            { $addFields: { camIds : '$cameraConfigs._id' } },
            {
              $set: {
                cameraConfigs: {
                  $cond: {
                    if: { $in: [cameraId, '$camIds'] },
                    then: '$cameraConfigs',
                    else: { $concatArrays: ['$cameraConfigs', [newCamConfig]] }
                  }
                }
              }
            }
          ],
          { returnDocument: 'after' }
        );

        console.log('updatedProject: ', updatedProject);

        if (updatedProject.cameraConfigs.length > project.cameraConfigs.length) {
          console.log('Couldn\'t find a camera config with that _id, so added one to project: ', updatedProject);
        }

        return updatedProject;
      }, { retries: 2 });
    };

    try {
      return await operation(input, context);
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async createView(input, context) {
    const operation = async (input) => {
      return await retry(async () => {
        // find project, add new view, and save
        const [project] = await ProjectModel.getProjects(
          { _ids: [context.user['curr_project']] },
          context
        );
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
  }

  static async updateView(input, context) {
    const operation = async (input) => {
      return await retry(async (bail) => {
        // find view
        const [project] = await ProjectModel.getProjects(
          { _ids: [context.user['curr_project']] },
          context
        );
        const view = project.views.find((v) => idMatch(v._id, input.viewId));
        if (!view.editable) {
          bail(new ForbiddenError(`View ${view.name} is not editable`));
        }

        // appy updates & save project
        for (const [key, newVal] of Object.entries(input.diffs)) {
          view[key] = newVal;
        }
        const updatedProj = await project.save();
        return updatedProj.views.find((v) => idMatch(v._id, input.viewId));

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

  static async deleteView(input, context) {
    const operation = async (input) => {
      return await retry(async (bail) => {

        // find view
        const [project] = await ProjectModel.getProjects(
          { _ids: [context.user['curr_project']] },
          context
        );
        const view = project.views.find((v) => idMatch(v._id, input.viewId));
        if (!view.editable) {
          bail(new ForbiddenError(`View ${view.name} is not editable`));
        }

        // remove view from project and save
        project.views = project.views.filter((v) => !idMatch(v._id, input.viewId));
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

  static async updateAutomationRules(input, context) {
    const operation = async ({ automationRules }) => {
      return await retry(async () => {
        console.log('attempting to update automation rules with: ', automationRules);
        const [project] = await ProjectModel.getProjects(
          { _ids: [context.user['curr_project']] },
          context
        );
        project.automationRules = automationRules;
        await project.save();
        return project.automationRules;
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

  static async reMapImagesToDeps({ projId, camConfig }) {
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
  }

  static async createDeployment(input, context) {
    const operation = async ({ cameraId, deployment }) => {
      return await retry(async () => {

        // find camera config
        const [project] = await ProjectModel.getProjects(
          { _ids: [context.user['curr_project']] },
          context
        );
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
      await ProjectModel.reMapImagesToDeps({ projId: project._id, camConfig });
      return camConfig;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async updateDeployment(input, context) {
    const operation = async ({ cameraId, deploymentId, diffs }) => {
      return await retry(async (bail) => {

        // find deployment
        const [project] = await ProjectModel.getProjects(
          { _ids: [context.user['curr_project']] },
          context
        );
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
        await ProjectModel.reMapImagesToDeps({ projId: project._id, camConfig });
      }
      return camConfig;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  static async deleteDeployment(input, context) {
    const operation = async ({ cameraId, deploymentId }) => {
      return await retry(async () => {

        // find camera config
        const [project] = await ProjectModel.getProjects(
          { _ids: [context.user['curr_project']] },
          context
        );
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
      await ProjectModel.reMapImagesToDeps({ projId: project._id, camConfig });
      return camConfig;
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }
}

export default class AuthedProjectModel {
  constructor(user) {
    this.user = user;
  }

  async getProjects(input, context) {
    return await ProjectModel.getProjects(input, context);
  }

  async createProject(input, context) {
    return await ProjectModel.createProject(input, context);
  }

  async createView(input, context) {
    if (!hasRole(this.user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return await ProjectModel.createView(input, context);
  }

  async updateView(input, context) {
    if (!hasRole(this.user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return await ProjectModel.updateView(input, context);
  }

  async deleteView(input, context) {
    if (!hasRole(this.user, WRITE_VIEWS_ROLES)) throw new ForbiddenError;
    return await ProjectModel.deleteView(input, context);
  }

  async updateAutomationRules(input, context) {
    if (!hasRole(this.user, WRITE_AUTOMATION_RULES_ROLES)) throw new ForbiddenError;
    return await ProjectModel.updateAutomationRules(input, context);
  }

  async createDeployment(input, context) {
    if (!hasRole(this.user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return await ProjectModel.createDeployment(input, context);
  }

  async updateDeployment(input, context) {
    if (!hasRole(this.user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return await ProjectModel.updateDeployment(input, context);
  }

  async deleteDeployment(input, context) {
    if (!hasRole(this.user, WRITE_DEPLOYMENTS_ROLES)) throw new ForbiddenError;
    return await ProjectModel.deleteDeployment(input, context);
  }
}
