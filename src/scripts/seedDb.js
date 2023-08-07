import { ApolloError } from 'apollo-server-errors';
import { getConfig } from '../config/config.js';
import { connectToDatabase } from '../api/db/connect.js';
import Project from '../api/db/schemas/Project.js';
import MLModel from '../api/db/schemas/MLModel.js';


const defaultMLModelsConfig = [
  {
    _id: 'megadetector_v5a',
    version: 'v5.0a',
    description: 'Microsoft Megadetector v5a',
    defaultConfThreshold: 0.25,
    categories: [
      { _id: '1', name: 'animal' },
      { _id: '2', name: 'person' },
      { _id: '3', name: 'vehicle' }
    ]
  },
  {
    _id: 'megadetector_v5b',
    version: 'v5.0b',
    description: 'Microsoft Megadetector v5b',
    defaultConfThreshold: 0.25,
    categories: [
      { _id: '1', name: 'animal' },
      { _id: '2', name: 'person' },
      { _id: '3', name: 'vehicle' }
    ]
  },
  {
    _id: 'mirav2',
    version: 'v2.0',
    description: 'Santa Cruz Island classifier',
    defaultConfThreshold: 0.8,
    categories: [
      { _id: 'bird', name: 'bird' },
      { _id: 'fox', name: 'fox' },
      { _id: 'lizard', name: 'lizard' },
      { _id: 'skunk', name: 'skunk' },
      { _id: 'rodent', name: 'rodent' }
    ]
  },
  {
    _id: 'nzdoc',
    version: 'v1.0',
    description: 'New Zealand Department of Conservation classifier',
    defaultConfThreshold: 0.4,
    categories: [
      { _id: 'bellbird', name: 'bellbird' },
      { _id: 'bird_sp', name: 'bird_sp' },
      { _id: 'blackbird',name: 'blackbird' },
      { _id: 'brown_creeper', name: 'brown_creeper' },
      {  _id: 'canada_goose', name: 'canada_goose' },
      { _id: 'cat', name: 'cat' },
      { _id: 'chaffinch', name: 'chaffinch' },
      { _id: 'cow', name: 'cow' },
      { _id: 'deer', name: 'deer' },
      { _id: 'dog', name: 'dog' },
      { _id: 'dunnock', name: 'dunnock' },
      { _id: 'empty', name: 'empty' },
      { _id: 'fantail', name: 'fantail' },
      { _id: 'goldfinch', name: 'goldfinch' },
      { _id: 'goose', name: 'goose' },
      { _id: 'greenfinch', name: 'greenfinch' },
      { _id: 'grey_warbler', name: 'grey_warbler' },
      { _id: 'hare', name: 'hare' },
      { _id: 'harrier', name: 'harrier' },
      { _id: 'hedgehog', name: 'hedgehog' },
      { _id: 'human', name: 'human' },
      { _id: 'insect', name: 'insect' },
      { _id: 'kaka', name: 'kaka' },
      { _id: 'kakariki', name: 'kakariki' },
      { _id: 'kea', name: 'kea' },
      { _id: 'kingfisher', name: 'kingfisher' },
      { _id: 'lagomorph_sp', name: 'lagomorph_sp' },
      { _id: 'lizard', name: 'lizard' },
      { _id: 'magpie', name: 'magpie' },
      { _id: 'morepork', name: 'morepork' },
      { _id: 'moth', name: 'moth' },
      { _id: 'mouse', name: 'mouse' },
      { _id: 'pig', name: 'pig' },
      { _id: 'pipit', name: 'pipit' },
      { _id: 'possum', name: 'possum' },
      { _id: 'quail', name: 'quail' },
      { _id: 'rabbit', name: 'rabbit' },
      { _id: 'rat', name: 'rat' },
      { _id: 'redpoll', name: 'redpoll' },
      { _id: 'rifleman', name: 'rifleman' },
      { _id: 'robin', name: 'robin' },
      { _id: 'sheep', name: 'sheep' },
      { _id: 'silvereye', name: 'silvereye' },
      { _id: 'starling', name: 'starling' },
      { _id: 'stoat', name: 'stoat' },
      { _id: 'thrush', name: 'thrush' },
      { _id: 'tomtit', name: 'tomtit' },
      { _id: 'tui', name: 'tui' },
      { _id: 'warbler', name: 'warbler' },
      { _id: 'weasel', name: 'weasel' },
      { _id: 'weka', name: 'weka' },
      { _id: 'yellowhammer', name: 'yellowhammer' }
    ]
  }
];



const defaultViewsConfig = [{
  name: 'All images',
  filters: {},
  description: 'Default view of all images. This view is not editable.',
  editable: false
}];

const defaultProjectsConfig = [
  {
    _id: 'default_project',
    name: 'Default project',
    description: 'Default project',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector_v5a', 'mirav2'],
    automationRules: [{
      event: { type: 'image-added' },
      action: { type: 'run-inference', mlModel: 'megadetector_v5a' },
      name: 'Run Megadetector on all new images'
    }]
  },
  // NOTE: THIS IS TEMPORARY! remove after seeding DBs
  {
    _id: 'sci_biosecurity',
    name: 'SCI Biosecurity',
    description: 'Biosecurity camera network on Santa Cruz Island',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector_v5a', 'mirav2'],
    automationRules: [{
      event: { type: 'image-added' },
      action: { type: 'run-inference', mlModel: 'megadetector_v5a' },
      name: 'Run Megadetector on all new images'
    }]
  },
  // NOTE: THIS IS TEMPORARY! remove after seeding DBs
  {
    _id: 'jldp',
    name: 'Dangermond Preserve',
    description: 'Camera trap on JLDP',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector_v5a'],
    automationRules: [{
      event: { type: 'image-added' },
      action: { type: 'run-inference', mlModel: 'megadetector_v5a' },
      name: 'Run Megadetector on all new images'
    }]
  }
];

async function createDefaultMLModels({ defaultMLModelsConfig }) {
  console.log('Creating default models...');
  let existingMLModelIds = await MLModel.find({}, '_id');
  existingMLModelIds = existingMLModelIds.map((model) => model._id);
  console.log('Found existing models: ', existingMLModelIds);

  const newModelRecords = [];
  for (const modelConfig of defaultMLModelsConfig) {
    if (!existingMLModelIds.includes(modelConfig._id)) {
      try {
        const newModel = new MLModel(modelConfig);
        await newModel.save();
        newModelRecords.push(newModel);
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  }
  console.log('Successfully created new Model records: ', newModelRecords);
  return newModelRecords;
}

async function createDefaultProjects({ defaultProjectsConfig }) {
  console.log('Creaing default projects...');
  let existingProjIds = await await Project.find({}, '_id');
  existingProjIds = existingProjIds.map((proj) => proj._id);
  console.log('Found existing projects: ', existingProjIds);

  const newProjectRecords = [];
  for (const projectConfig of defaultProjectsConfig) {
    if (!existingProjIds.includes(projectConfig._id)) {
      try {
        const newProject = new Project(projectConfig);
        await newProject.save();
        newProjectRecords.push(newProject);
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
  console.log('Seeding Db with config: ', config);

  try {

    // create default project records
    await createDefaultProjects({ defaultProjectsConfig });

    // create default ml model records
    await createDefaultMLModels({ defaultMLModelsConfig });

    dbClient.connection.close();
    process.exit(0);
  } catch (err) {
    console.log('An error occured seeding the database: ', err);
    dbClient.connection.close();
    process.exit(1);
  }
}

seedDB();
