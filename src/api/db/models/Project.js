const { ApolloError } = require('apollo-server-errors');
const Project = require('../schemas/Project');
const Image = require('../schemas/Image');
const utils = require('./utils');
const retry = require('async-retry');


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
      throw new ApolloError(err);
    }
  },

  get createCameraConfig() {
    return async (projectId, cameraSn) => {
    // if (!hasRole(user, ['animl_sci_project_owner', 'animl_superuser'])) {
    //   return null;
    // }

      const operation = async (projectId, cameraSn) => {
        return await retry(async (bail) => {

          const [ project ] = await this.getProjects([projectId]);
          console.log(`ProjectModel.createCameraConfig() - found project: ${project}`);
          
          // make sure project doesn't already have a config for this cam
          const currCamConfig = project.cameras.find((c) => c._id === cameraSn);
          if (!currCamConfig) {
            project.cameras.push({
              _id: cameraSn,
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
        console.log(`ProjectModel.createCameraConfig() - cameraSn: ${cameraSn}`);
        return await operation(projectId, cameraSn);
      } catch (err) {
        throw new ApolloError(err);
      }
    };
  },
 
  get createView() {
    return async (input) => {
      console.log(`ProjectModel.createView() - input: ${input}`);

      const operation = async (input) => {
        return await retry(async (bail) => {
          const [ project ] = await this.getProjects([user['curr_project']]);
          console.log(`ProjectModel.createView() - project: `, project);
          const newView = {
            name: input.name,
            filters: input.filters,
            ...(input.description && { description: input.description }),
            editable: input.editable,
          };
          project.views.push(newView)
          const updatedProj = await project.save();
          // TODO: see if this incldues _id field.
          // if so we dont need to find the view below
          console.log(`ProjectModel.createView() - newView: `, newView); 
          return updatedProj.views.find((v) => v.name === newView.name);
        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get updateView() {
    return async (input) => {
      console.log(`ProjectModel.updateView() - input: ${input}`);

      const operation = async ({ _id, diffs }) => {
        return await retry(async (bail) => {
          const [ project ] = await this.getProjects([user['curr_project']]);
          let view = project.views.find((view) => (
            view._id.toString() === _id.toString()
          ));
          if (!view.editable) {
            bail(new ApolloError(`View ${view.name} is not editable`));
          }

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
        throw new ApolloError(err);
      }
    }
  },

  get deleteView() {
    return async (input) => {
      console.log(`ProjectModel.deleteView() - input: ${input}`);

      const operation = async ({ _id }) => {
        return await retry(async (bail) => {

          const [ project ] = await this.getProjects([user['curr_project']]);
          let view = project.views.find((view) => (
            view._id.toString() === _id.toString()
          ));
          if (!view.editable) {
            bail(new ApolloError(`View ${view.name} is not editable`));
          }

          project.views = project.views.filter((view) => (
            view._id.toString() !== _id.toString()
          ));
          return await project.save();

        }, { retries: 2 });
      };

      try {
        return await operation(input);
      } catch (err) {
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

          let filter = { project: projId, cameraSn: camConfig._id };
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
      }, { retries: 2 });
    };

    try {
      await operation({ projId, camConfig });
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  get createDeployment() {
    return async (input) => {
      console.log(`ProjectModel.createDeployment() - deployment: ${JSON.stringify(input)}`);

      const operation = async ({ cameraId, deployment }) => {
        return await retry(async (bail) => {
          const [ project ] = await this.getProjects([user['curr_project']]);
          let camConfig = project.cameras.find((camConfig) => (
            camConfig._id.toString() ===  cameraId.toString()
          ));

          camConfig.deployments.push(deployment);
          camConfig.deployments = utils.sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };

        }, { retries: 2 });
      };

      try {
        const { project, camConfig } = await operation(input);
        await this.reMapImagesToDeps({ projId: project._id, camConfig });
        return camConfig;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get updateDeployment() {
    return async (input) => {
      console.log(`ProjectModel.updateDeployment() - input: ${JSON.stringify(input)}`);

      const operation = async ({ cameraId, deploymentId, diffs }) => {
        return await retry(async (bail) => {
          const [ project ] = await this.getProjects([user['curr_project']]);
          let camConfig = project.cameras.find((camConfig) => (
            camConfig._id.toString() ===  cameraId.toString()
          ));
          let deployment = camConfig.deployments.find((dep) => (
            dep._id.toString() === deploymentId.toString()
          ));

          // TODO: figure out uniform handling of illegal operations? thow error?
          // return res.success info? (e.g. if deployment IS 'default')
          // need to use "bail" to exit retry loop intentionally
          if (deployment.name !== 'default') {
            for (let [key, newVal] of Object.entries(diffs)) {
              deployment[key] = newVal;
            }
            camConfig.deployments = utils.sortDeps(camConfig.deployments);
            await project.save();
          }
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
        throw new ApolloError(err);
      }
    }
  },

  get deleteDeployment() {
    return async (input) => {
      console.log(`ProjectModel.deleteDeployment() - input: ${JSON.stringify(input)}`);

      const operation = async ({ cameraId, deploymentId }) => {
        return await retry(async (bail) => {
          const [ project ] = await this.getProjects([user['curr_project']]);
          let camConfig = project.cameras.find((camConfig) => (
            camConfig._id.toString() ===  cameraId.toString()
          ));

          camConfig.deployments = camConfig.deployments.filter((dep) => (
            dep._id.toString() !== deploymentId.toString()
          ));
          camConfig.deployments = utils.sortDeps(camConfig.deployments);
          await project.save();
          return { project, camConfig };

        }, { retries: 2 });
      };
      
      try {
        const { project, camConfig } = await operation(input);
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
