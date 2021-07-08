const CreateImageInput = require('./inputs/CreateImageInput');
const CreateLabelsInput = require('./inputs/CreateLabelsInput');
const CreateViewInput = require('./inputs/CreateViewInput');
const DeleteViewInput = require('./inputs/DeleteViewInput');
const QueryImageInput = require('./inputs/QueryImageInput');
const UpdateObjectsInput = require('./inputs/UpdateObjectsInput');
const UpdateViewInput = require('./inputs/UpdateViewInput');

const AutomationRule = require('./objects/AutomationRule');
const Camera = require('./objects/Camera');
const Filters = require('./objects/Filters');
const Image = require('./objects/Image');
const Label = require('./objects/Label');
const Location = require('./objects/Location');
const Model = require('./objects/Model');
const PageInfo = require('./objects/PageInfo');
const Scalars = require('./objects/Scalars');
const View = require('./objects/View');

const CreateImagePayload = require('./payloads/CreateImagePayload');
const CreateLabelsPayload = require('./payloads/CreateLabelsPayload');
const CreateViewPayload = require('./payloads/CreateViewPayload');
const DeleteViewPayload = require('./payloads/DeleteViewPayload');
const ImageConnection = require('./payloads/ImageConnection');
const UpdateObjectsPayload = require('./payloads/UpdateObjectsPayload');
const UpdateViewPayload = require('./payloads/UpdateViewPayload');

const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this apporach with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  CreateImageInput,
  CreateLabelsInput,
  CreateViewInput,
  DeleteViewInput,
  QueryImageInput,
  UpdateObjectsInput,
  UpdateViewInput,
  AutomationRule,
  Camera,
  Filters,
  Image,
  Label,
  Location,
  Model,
  PageInfo,
  Scalars,
  View,
  CreateImagePayload,
  CreateLabelsPayload,
  CreateViewPayload,
  DeleteViewPayload,
  ImageConnection,
  UpdateObjectsPayload,
  UpdateViewPayload,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
