const CreateImageInput = require('./inputs/CreateImageInput');
const CreateLabelsInput = require('./inputs/CreateLabelsInput');
const CreateObjectInput = require('./inputs/CreateObjectInput');
const CreateViewInput = require('./inputs/CreateViewInput');
const DeleteLabelInput = require('./inputs/DeleteLabelInput');
const DeleteObjectInput = require('./inputs/DeleteObjectInput');
const DeleteViewInput = require('./inputs/DeleteViewInput');
const QueryImageInput = require('./inputs/QueryImageInput');
const UpdateLabelInput = require('./inputs/UpdateLabelInput');
const UpdateObjectInput = require('./inputs/UpdateObjectInput');
// const UpdateObjectsInput = require('./inputs/UpdateObjectsInput');
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
const CreateObjectPayload = require('./payloads/CreateObjectPayload');
const CreateViewPayload = require('./payloads/CreateViewPayload');
const DeleteLabelPayload = require('./payloads/DeleteLabelPayload');
const DeleteObjectPayload = require('./payloads/DeleteObjectPayload');
const DeleteViewPayload = require('./payloads/DeleteViewPayload');
const ImageConnection = require('./payloads/ImageConnection');
const UpdateLabelPayload = require('./payloads/UpdateLabelPayload');
const UpdateObjectPayload = require('./payloads/UpdateObjectPayload');
// const UpdateObjectsPayload = require('./payloads/UpdateObjectsPayload');
const UpdateViewPayload = require('./payloads/UpdateViewPayload');

const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this nightmare with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  CreateImageInput,
  CreateLabelsInput,
  CreateObjectInput,
  CreateViewInput,
  DeleteLabelInput,
  DeleteObjectInput,
  DeleteViewInput,
  QueryImageInput,
  UpdateLabelInput,
  UpdateObjectInput,
  // UpdateObjectsInput,
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
  CreateObjectPayload,
  CreateViewPayload,
  DeleteLabelPayload,
  DeleteObjectPayload,
  DeleteViewPayload,
  ImageConnection,
  UpdateLabelPayload,
  UpdateObjectPayload,
  // UpdateObjectsPayload,
  UpdateViewPayload,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
