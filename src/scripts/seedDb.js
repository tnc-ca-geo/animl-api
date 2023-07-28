import { ApolloError } from 'apollo-server-errors';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import generateProjectModel from '../api/db/models/Project.js';
import generateMLModelModel from '../api/db/models/MLModel.js';

const defaultMLModelsConfig = [
  {
    _id: 'megadetector',
    version: 'v5.0a',
    description: 'Microsoft Megadetector',
    defaultConfThreshold: 0.25,
    categories: [
      { _id: '1', name: 'animal' },
      { _id: '2', name: 'person' },
      { _id: '3', name: 'vehicle' }
    ]
  },
  {
    _id: 'mira',
    version: 'v1.0',
    description: 'Santa Cruz Island classifier',
    defaultConfThreshold: 0.8,
    categories: [
      { _id: 'fox', name: 'fox' },
      { _id: 'skunk', name: 'skunk' },
      { _id: 'rodent', name: 'rodent' },
      { _id: 'empty', name: 'empty' }
    ]
  }
];

const defaultViewsConfig = [{
  name: 'All images',
  filters: {},
  description: 'Default view of all images. This view is not editable.',
  editable: false
  // NOTE: commenting this out so that users have ability to adjust
  // category configs (e.g. turn off 'vehicle' label)
  // automationRules: [{
  //   event: { type: 'image-added' },
  //   action: { type: 'run-inference', mlModel: 'megadetector' },
  //   name: 'Run Megadetector on all new images',
  // }],
}];

const defaultProjectsConfig = [
  {
    _id: 'default_project',
    name: 'Default project',
    description: 'Default project',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector', 'mira']
  },
  // NOTE: THIS IS TEMPORARY! remove after seeding DBs
  {
    _id: 'sci_biosecurity',
    name: 'SCI Biosecurity',
    description: 'Biosecurity camera network on Santa Cruz Island',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector', 'mira']
  },
  // NOTE: THIS IS TEMPORARY! remove after seeding DBs
  {
    _id: 'jldp',
    name: 'Dangermond Preserve',
    description: 'Camera trap on JLDP',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector']
  },
  // NOTE: THIS IS TEMPORARY! remove after seeding DBs
  {
    _id: 'catalina',
    name: 'Catalina Island',
    description: 'Experimental control network on Catalina Island',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector', 'mira']
  }
];

async function createDefaultMLModels(params) {
  const { dbModels, defaultMLModelsConfig } = params;

  console.log('Creaing default models...');
  const existingMLModels = await dbModels.MLModel.getMLModels();
  const existingMLModelIds = existingMLModels.map((mdl) => mdl._id);
  console.log('Found existing models: ', existingMLModelIds);
  // if (existingMLModels.length !== 0) {
  //   console.log('Found exising ML models in db; skipping: ', existingMLModels);
  //   return;
  // }

  const newModelRecords = [];
  for (const modelConfig of defaultMLModelsConfig) {
    if (!existingMLModelIds.includes(modelConfig._id)) {
      try {
        const newModelRecord = await dbModels.MLModel.createMLModel(modelConfig);
        newModelRecords.push(newModelRecord);
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  }
  console.log('Successfully created new Model records: ', newModelRecords);
  return newModelRecords;
}

async function createDefaultProjects(params) {
  const { dbModels, defaultProjectsConfig } = params;

  console.log('Creaing default projects...');
  const existingProjects = await dbModels.Project.getProjects();
  const existingProjIds = existingProjects.map((proj) => proj._id);
  console.log('Found existing projects: ', existingProjIds);

  // if (existingProjects.length !== 0) {
  //   console.log('Found exising projects in db; skipping: ', existingProjects);
  //   return;
  // }

  const newProjectRecords = [];
  for (const project of defaultProjectsConfig) {
    if (!existingProjIds.includes(project._id)) {
      try {
        const newProjectRecord = await dbModels.Project.createProject(project);
        newProjectRecords.push(newProjectRecord);
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  }

  console.log('Successfully created new Project records: ', newProjectRecords);
  return newProjectRecords;
}

async function seedDB() {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);
  const user = { 'is_superuser': true };
  console.log('Seeding Db with config: ', config);

  try {

    const dbModels = {
      Project: generateProjectModel({ user }),
      MLModel: generateMLModelModel({ user })
    };

    // create default project records
    await createDefaultProjects({
      defaultProjectsConfig,
      dbModels
    });

    // create default ml model records
    await createDefaultMLModels({
      defaultMLModelsConfig,
      dbModels
    });

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('An error occured seeding the database: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
}

seedDB();
