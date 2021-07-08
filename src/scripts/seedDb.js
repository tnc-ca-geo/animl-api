const { ApolloError } = require('apollo-server-errors');
const { getConfig } = require('../../config/config');
const { connectToDatabase } = require('../db/connect');
const generateViewModel = require('../db/models/View');
const generateModelModel = require('../db/models/Model');

let defaultModelsConfig = [
  {
    name: 'megadetector',
    version: 'v4.1',
    description: 'Microsoft Megadetector',
    // TODO: double check whether these config values are actually getting used
    renderThreshold: 0.8,
    categories: {
      1: 'animal',
      2: 'person',
      4: 'vehicle'
    },
    defaultModel: true,
  },
  {
    name: 'mira',
    version: '1.0',
    description: 'Santa Cruz Island classifier',
    renderThreshold: 0.8,
  },
];

let defaultViewsConfig = [{
  name: 'All images',
  filters: {},
  description: `Default view of all images. This view is not editable.`,
  editable: false,
  automationRules: [{
    event: { type: 'image-added' },
    action: { type: 'run-inference', model: null },
    name: 'Run Megadetector on all new images',
  }],
}];

function getDefaultModelId(defaultModelsConfig, newModelRecords) {
  const defaultModelConfig = defaultModelsConfig.find((model) => (
    model.defaultModel
  ));
  const defaultModelId = newModelRecords.find((model) => (
    model.name === defaultModelConfig.name && 
    model.version === defaultModelConfig.version
  ))._id;
  return defaultModelId;
};

async function createDefaultViews(params) {
  const {
    dbModels,
    newModelRecords,
    defaultViewsConfig,
    defaultModelsConfig,
  } = params;
  let newViewRecords = [];

  const existingViews = await dbModels.View.getViews();
  if (existingViews.length === 0) {
    for (const view of defaultViewsConfig) {
      if (view.name === 'All images') {
        console.log('default view automation rules: ', view.automationRules)
        const modelId = getDefaultModelId(defaultModelsConfig, newModelRecords);
        view.automationRules[0].action.model = modelId;
      }
      try {
        const newViewRecord = await dbModels.View.createView(view);
        newViewRecords.push(newViewRecord);
      } catch (err) {
        throw new ApolloError(err);
      }
    }
    console.log('Successfully created new View records: ', newViewRecords);
  }
  return newViewRecords;
};

async function createDefaultModels(params) {
  const { dbModels, defaultModelsConfig } = params;
  let newModelRecords = [];
  
  const existingModels = await dbModels.Model.getModels();
  console.log('exising models found in db: ', existingModels);
  if (existingModels.length === 0) {
    for (const mlModel of defaultModelsConfig) {
      try {
        const newModelRecord = await dbModels.Model.createModel(mlModel);
        newModelRecords.push(newModelRecord);
      } catch (err) {
        throw new ApolloError(err);
      }
    }
    console.log('Successfully created new Model records: ', newModelRecords);
  }
  return newModelRecords;
};

async function seedDB() {
  const config = await getConfig();
  const dbClient = await connectToDatabase(config);

  try {
    const dbModels = {
      View: generateViewModel(),
      Model: generateModelModel(),
    };
  
    // create default ml model records
    const newModelRecords = await createDefaultModels({
      dbModels,
      defaultModelsConfig,
    });
  
    // create default view records
    const newViewRecords = await createDefaultViews({
      dbModels,
      newModelRecords,
      defaultViewsConfig,
      defaultModelsConfig,
    });
  
    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('An error occured seeding the database: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
};

seedDB();
