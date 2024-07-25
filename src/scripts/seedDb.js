import mongoose from 'mongoose';
import { InternalServerError } from '../../.build/api/errors.js';
import { getConfig } from '../../.build/config/config.js';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import Project from '../../.build/api/db/schemas/Project.js';
import MLModel from '../../.build/api/db/schemas/MLModel.js';

const defaultMLModelsConfig = [
  {
    _id: 'megadetector_v5a',
    version: 'v5.0a',
    description: 'Microsoft Megadetector v5a',
    defaultConfThreshold: 0.25,
    categories: [
      {
        _id: '0',
        name: 'empty',
        color: '#8D8D8D',
      },
      {
        _id: '1',
        name: 'animal',
        color: '#00A2C7',
      },
      {
        _id: '2',
        name: 'person',
        color: '#86EAD4',
      },
      {
        _id: '3',
        name: 'vehicle',
        color: '#F76B15',
      },
    ],
  },
  {
    _id: 'megadetector_v5b',
    version: 'v5.0b',
    description: 'Microsoft Megadetector v5b',
    defaultConfThreshold: 0.25,
    categories: [
      {
        _id: '0',
        name: 'empty',
        color: '#8D8D8D',
      },
      {
        _id: '1',
        name: 'animal',
        color: '#00A2C7',
      },
      {
        _id: '2',
        name: 'person',
        color: '#86EAD4',
      },
      {
        _id: '3',
        name: 'vehicle',
        color: '#F76B15',
      },
    ],
  },
  {
    _id: 'mirav2',
    version: 'v2.0',
    description: 'Santa Cruz Island classifier',
    defaultConfThreshold: 0.8,
    categories: [
      {
        _id: 'bird',
        name: 'bird',
        color: '#6E56CF',
      },
      {
        _id: 'fox',
        name: 'fox',
        color: '#3E63DD',
      },
      {
        _id: 'lizard',
        name: 'lizard',
        color: '#30A46C',
      },
      {
        _id: 'skunk',
        name: 'skunk',
        color: '#E93D82',
      },
      {
        _id: 'rodent',
        name: 'rodent',
        color: '#E54D2E',
      },
    ],
  },
  {
    _id: 'nzdoc',
    version: 'v1.0',
    description: 'New Zealand Department of Conservation classifier',
    defaultConfThreshold: 0.4,
    categories: [
      { _id: 'bellbird', name: 'bellbird', color: '#E54D2E' },
      { _id: 'bird_sp', name: 'bird_sp', color: '#E5484D' },
      { _id: 'blackbird', name: 'blackbird', color: '#E54666' },
      { _id: 'brown_creeper', name: 'brown_creeper', color: '#E93D82' },
      { _id: 'canada_goose', name: 'canada_goose', color: '#D6409F' },
      { _id: 'cat', name: 'cat', color: '#AB4ABA' },
      { _id: 'chaffinch', name: 'chaffinch', color: '#8E4EC6' },
      { _id: 'cow', name: 'cow', color: '#6E56CF' },
      { _id: 'deer', name: 'deer', color: '#5B5BD6' },
      { _id: 'dog', name: 'dog', color: '#3E63DD' },
      { _id: 'dunnock', name: 'dunnock', color: '#0090FF' },
      { _id: 'empty', name: 'empty', color: '#00A2C7' },
      { _id: 'fantail', name: 'fantail', color: '#12A594' },
      { _id: 'goldfinch', name: 'goldfinch', color: '#29A383' },
      { _id: 'goose', name: 'goose', color: '#30A46C' },
      { _id: 'greenfinch', name: 'greenfinch', color: '#46A758' },
      { _id: 'grey_warbler', name: 'grey_warbler', color: '#A18072' },
      { _id: 'hare', name: 'hare', color: '#978365' },
      { _id: 'harrier', name: 'harrier', color: '#AD7F58' },
      { _id: 'hedgehog', name: 'hedgehog', color: '#F76B15' },
      { _id: 'human', name: 'human', color: '#FFC53D' },
      { _id: 'insect', name: 'insect', color: '#FFE629' },
      { _id: 'kaka', name: 'kaka', color: '#BDEE63' },
      { _id: 'kakariki', name: 'kakariki', color: '#86EAD4' },
      { _id: 'kea', name: 'kea', color: '#7CE2FE' },
      { _id: 'kingfisher', name: 'kingfisher', color: '#E54D2E' },
      { _id: 'lagomorph_sp', name: 'lagomorph_sp', color: '#E5484D' },
      { _id: 'lizard', name: 'lizard', color: '#E54666' },
      { _id: 'magpie', name: 'magpie', color: '#D6409F' },
      { _id: 'morepork', name: 'morepork', color: '#D6409F' },
      { _id: 'moth', name: 'moth', color: '#AB4ABA' },
      { _id: 'mouse', name: 'mouse', color: '#8E4EC6' },
      { _id: 'pig', name: 'pig', color: '#6E56CF' },
      { _id: 'pipit', name: 'pipit', color: '#5B5BD6' },
      { _id: 'possum', name: 'possum', color: '#3E63DD' },
      { _id: 'quail', name: 'quail', color: '#0090FF' },
      { _id: 'rabbit', name: 'rabbit', color: '#00A2C7' },
      { _id: 'rat', name: 'rat', color: '#12A594' },
      { _id: 'redpoll', name: 'redpoll', color: '#29A383' },
      { _id: 'rifleman', name: 'rifleman', color: '#30A46C' },
      { _id: 'robin', name: 'robin', color: '#46A758' },
      { _id: 'sheep', name: 'sheep', color: '#A18072' },
      { _id: 'silvereye', name: 'silvereye', color: '#978365' },
      { _id: 'starling', name: 'starling', color: '#AD7F58' },
      { _id: 'stoat', name: 'stoat', color: '#F76B15' },
      { _id: 'thrush', name: 'thrush', color: '#FFC53D' },
      { _id: 'tomtit', name: 'tomtit', color: '#FFE629' },
      { _id: 'tui', name: 'tui', color: '#BDEE63' },
      { _id: 'warbler', name: 'warbler', color: '#86EAD4' },
      { _id: 'weasel', name: 'weasel', color: '#7CE2FE' },
      { _id: 'weka', name: 'weka', color: '#E54D2E' },
      { _id: 'yellowhammer', name: 'yellowhammer', color: '#E5484D' },
    ],
  },
];

const defaultViewsConfig = [
  {
    name: 'All images',
    filters: {},
    description: 'Default view of all images. This view is not editable.',
    editable: false,
  },
];

const defaultProjectsConfig = [
  {
    _id: 'default_project',
    name: 'Default project',
    description: 'Default project',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector_v5a', 'mirav2'],
    automationRules: [
      {
        event: { type: 'image-added' },
        action: { type: 'run-inference', mlModel: 'megadetector_v5a' },
        name: 'Run Megadetector on all new images',
      },
    ],
  },
  // NOTE: THIS IS TEMPORARY! remove after seeding DBs
  {
    _id: 'sci_biosecurity',
    name: 'SCI Biosecurity',
    description: 'Biosecurity camera network on Santa Cruz Island',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector_v5a', 'mirav2'],
    automationRules: [
      {
        event: { type: 'image-added' },
        action: { type: 'run-inference', mlModel: 'megadetector_v5a' },
        name: 'Run Megadetector on all new images',
      },
    ],
  },
  // NOTE: THIS IS TEMPORARY! remove after seeding DBs
  {
    _id: 'jldp',
    name: 'Dangermond Preserve',
    description: 'Camera trap on JLDP',
    timezone: 'America/Los_Angeles',
    views: defaultViewsConfig,
    availableMLModels: ['megadetector_v5a'],
    automationRules: [
      {
        event: { type: 'image-added' },
        action: { type: 'run-inference', mlModel: 'megadetector_v5a' },
        name: 'Run Megadetector on all new images',
      },
    ],
  },
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
        // TODO: gererate random colors for all categories? Or maybe just hardcode in what we have in prod for now
        const newModel = new MLModel(modelConfig);
        await newModel.save();
        newModelRecords.push(newModel);
      } catch (err) {
        throw new InternalServerError(err instanceof Error ? err.message : String(err));
      }
    }
  }
  console.log('Successfully created new Model records: ', newModelRecords);
  return newModelRecords;
}

async function createDefaultProjects({ defaultProjectsConfig }) {
  console.log('Creating default projects...');
  let existingProjIds = await Project.find({}, '_id');
  existingProjIds = existingProjIds.map((proj) => proj._id);
  console.log('Found existing projects: ', existingProjIds);

  const newProjectRecords = [];
  for (const projectConfig of defaultProjectsConfig) {
    if (!existingProjIds.includes(projectConfig._id)) {
      try {
        projectConfig.views = defaultViewsConfig.map((view) => ({
          _id: new mongoose.Types.ObjectId(),
          ...view,
        }));
        console.log('Creating new project with views: ', projectConfig.views);
        const newProject = new Project(projectConfig);
        await newProject.save();
        newProjectRecords.push(newProject);
      } catch (err) {
        throw new InternalServerError(err instanceof Error ? err.message : String(err));
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
