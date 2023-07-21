import { ApolloError } from 'apollo-server-errors';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import generateProjectModel from '../api/db/models/Project.js';

const defaultViewsConfig = [{
  name: 'All images',
  filters: {},
  description: 'Default view of all images. This view is not editable.',
  editable: false
}];

// Edit config for new project below:
const newProjectConfig = [
  {
    _id: 'robinson_crusoe',
    name: 'Robinson Crusoe',
    description: 'Robinson Crusoe camera traps',
    timezone: 'America/Santiago',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector']
  }
];

if (newProjectConfig._id === 'robinson_crusoe') throw new Error('Edit New Project before running');

// TODO: use client-cognito-identity-provider to automatically create cognito groups
// https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cognito-identity-provider/index.html
async function createNewProject(params) {
  const { dbModels, newProjectConfig } = params;

  const existingProjects = await dbModels.Project.getProjects();
  const existingProjIds = existingProjects.map((proj) => proj._id);
  console.log('Found existing projects: ', existingProjIds);

  const newProjectRecords = [];
  for (const project of newProjectConfig) {
    if (!existingProjIds.includes(project._id)) {
      try {
        const newProjectRecord = await dbModels.Project.createProject(project);
        newProjectRecords.push(newProjectRecord);
      } catch (err) {
        throw new ApolloError(err);
      }
    } else {
      console.log(`${project._id} already exists!`);
    }
  }

  console.log('Successfully created new Project records: ', newProjectRecords);
  return newProjectRecords;
}

async function createProject() {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);
  const user = { 'is_superuser': true };
  console.log('Creating new Project with config: ', config);

  try {

    const dbModels = {
      Project: generateProjectModel({ user })
    };

    // create new project records
    await createNewProject({
      newProjectConfig,
      dbModels
    });

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('An error occurred creating the project: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
}

createProject();
