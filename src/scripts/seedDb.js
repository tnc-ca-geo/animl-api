const { ApolloError } = require('apollo-server-errors');
const { getConfig } = require('../config/config');
const { connectToDatabase } = require('../api/db/connect');
const generateProjectModel = require('../api/db/models/Project');
const generateViewModel = require('../api/db/models/View');
const generateMLModelModel = require('../api/db/models/MLModel');

// TODO AUTH - this whole thing needs updating to reflect new schema changes

let defaultMLModelsConfig = [
  {
    _id: 'megadetector',
    version: 'v4.1',
    description: 'Microsoft Megadetector',
    defaultConfThreshold: 0.8,
    categories: [ // NEW
      { _id: '1', name: 'animal' },
      { _id: '2', name: 'person' },
      { _id: '3', name: 'vehicle' },
    ],
    // defaultModel: true, // TODO AUTH - is this used? it's not in Model Schema
  },
  {
    _id: 'mira',
    version: 'v1.0',
    description: 'Santa Cruz Island classifier',
    defaultConfThreshold: 0.8,
    categories: [ // NEW
      { _id: 'fox', name: 'fox' },
      { _id: 'skunk', name: 'skunk' },
      { _id: 'rodent', name: 'rodent' },
    ],
  },
];

let defaultViewsConfig = [{
  name: 'All images',
  filters: {},
  description: `Default view of all images. This view is not editable.`,
  editable: false,
  automationRules: [{
    event: { type: 'image-added' },
    action: { type: 'run-inference', mlModel: 'megadetector' }, // NEW - 'model' to 'mlModel'
    name: 'Run Megadetector on all new images',
  }],
}];

// NEW
let defaultProjectsConfig = [
  {
    _id: 'default_project',
    name: 'Default project',
    description: 'Default project',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector', 'mira'],
  },
  // TEMPORARY! remove after seeding DBs
  {
    _id: 'sci_biosecurity',
    name: 'SCI Biosecurity',
    description: 'Biosecurity camera network on Santa Cruz Island',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector', 'mira'],
  },

];

// function getDefaultModelId(defaultModelsConfig, newModelRecords) {
//   const defaultModelConfig = defaultMLModelsConfig.find((model) => (
//     model.defaultModel
//   ));
//   const defaultModelId = newModelRecords.find((model) => (
//     model.name === defaultModelConfig.name && 
//     model.version === defaultModelConfig.version
//   ))._id;
//   return defaultModelId;
// };

// async function createDefaultViews(params) {
//   const {
//     dbModels,
//     newModelRecords,
//     defaultViewsConfig,
//     defaultModelsConfig,
//   } = params;

//   console.log('Creaing default views...');
//   const existingViews = await dbModels.View.getViews();
//   if (existingViews.length !== 0) {
//     console.log('Found exising views in db; skipping: ', existingViews);
//     return;
//   }

//   let newViewRecords = [];
//   for (const view of defaultViewsConfig) {
//     if (view.name === 'All images') {
//       console.log('default view automation rules: ', view.automationRules)
//       const modelId = getDefaultModelId(defaultModelsConfig, newModelRecords);
//       view.automationRules[0].action.model = modelId;
//     }
//     try {
//       const newViewRecord = await dbModels.View.createView(view);
//       newViewRecords.push(newViewRecord);
//     } catch (err) {
//       throw new ApolloError(err);
//     }
//   }
//   console.log('Successfully created new View records: ', newViewRecords);
//   return newViewRecords;
// };

async function createDefaultMLModels(params) {
  const { dbModels, defaultMLModelsConfig } = params;
  
  console.log('Creaing default models: ', defaultMLModelsConfig);
  const existingMLModels = await dbModels.MLModel.getMLModels();
  if (existingMLModels.length !== 0) {
    console.log('Found exising ML models in db; skipping: ', existingMLModels);
    return;
  }

  let newModelRecords = [];
  for (const modelConfig of defaultMLModelsConfig) {
    try {
      const newModelRecord = await dbModels.MLModel.createMLModel(modelConfig);
      newModelRecords.push(newModelRecord);
    } catch (err) {
      throw new ApolloError(err);
    }
  }
  console.log('Successfully created new Model records: ', newModelRecords);
  return newModelRecords;
};

async function createDefaultProjects(params) {
  const { dbModels, defaultProjectsConfig } = params;
  
  console.log('Creaing default projects...');
  const existingProjects = await dbModels.Project.getProjects();
  if (existingProjects.length !== 0) {
    console.log('Found exising projects in db; skipping: ', existingProjects);
    return;
  }

  let newProjectRecords = [];
  for (const project of defaultProjectsConfig) {
    try {
      const newProjectRecord = await dbModels.Project.createProject(project);
      newProjectRecords.push(newProjectRecord);
    } catch (err) {
      throw new ApolloError(err);
    }
  }

  console.log('Successfully created new Project records: ', newProjectRecords);
  return newProjectRecords;
};

async function seedDB() {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);
  const user = { 'is_superuser': true };
  // TODO AUTH - does seedDB (and all other scripts) use /internal API path 
  // and thus are superusers?
  console.log('Seeding Db with config: ', config);

  try {

    const dbModels = {
      Project: generateProjectModel({ user }),
      // View: generateViewModel(),
      MLModel: generateMLModelModel({ user }),
    };

    // create default project records
    const newProjectRecords = await createDefaultProjects({
      defaultProjectsConfig,
      dbModels,
    });
  
    // create default ml model records
    const newModelRecords = await createDefaultMLModels({
      defaultMLModelsConfig,
      dbModels,
    });
    
    // // create default view records
    // const newViewRecords = await createDefaultViews({
    //   dbModels,
    //   newModelRecords,
    //   defaultViewsConfig,
    //   defaultModelsConfig,
    // });
  
    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('An error occured seeding the database: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
};

seedDB();
