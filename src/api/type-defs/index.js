const CreateImageInput = require('./inputs/CreateImageInput');
const CreateLabelInput = require('./inputs/CreateLabelInput');
const CreateViewInput = require('./inputs/CreateViewInput');
const DeleteViewInput = require('./inputs/DeleteViewInput');
const QueryImageInput = require('./inputs/QueryImageInput');
const UpdateViewInput = require('./inputs/UpdateViewInput');

const AutomationRule = require('./objects/AutomationRule');
const Camera = require('./objects/Camera');
const Filters = require('./objects/Filters');
const Image = require('./objects/Image');
const Label = require('./objects/Label');
const Location = require('./objects/Location');
const PageInfo = require('./objects/PageInfo');
const Scalars = require('./objects/Scalars');
const View = require('./objects/View');

const CreateImagePayload = require('./payloads/CreateImagePayload');
const CreateLabelPayload = require('./payloads/CreateLabelPayload');
const CreateViewPayload = require('./payloads/CreateViewPayload');
const DeleteViewPayload = require('./payloads/DeleteViewPayload');
const ImageConnection = require('./payloads/ImageConnection');
const UpdateViewPayload = require('./payloads/UpdateViewPayload');

const Mutation = require('./root/Mutation');
const Query = require('./root/Query');


// TODO: replace this apporach with merge-graphql-schemas utility 
// https://github.com/prisma-labs/graphql-yoga/tree/master/examples/modular-resolvers

const typeDefStrings = [
  CreateImageInput,
  CreateLabelInput,
  CreateViewInput,
  DeleteViewInput,
  QueryImageInput,
  UpdateViewInput,
  AutomationRule,
  Camera,
  Filters,
  Image,
  Label,
  Location,
  PageInfo,
  Scalars,
  View,
  CreateImagePayload,
  CreateLabelPayload,
  CreateViewPayload,
  DeleteViewPayload,
  ImageConnection,
  UpdateViewPayload,
  Mutation,
  Query,
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
