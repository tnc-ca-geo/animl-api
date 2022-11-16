const CreateDeploymentInput = require('./inputs/CreateDeploymentInput');
const CreateImageInput = require('./inputs/CreateImageInput');
const CreateLabelsInput = require('./inputs/CreateLabelsInput');
const CreateObjectInput = require('./inputs/CreateObjectInput');
const CreateViewInput = require('./inputs/CreateViewInput');

const DeleteDeploymentInput = require('./inputs/DeleteDeploymentInput');
const DeleteLabelInput = require('./inputs/DeleteLabelInput');
const DeleteObjectInput = require('./inputs/DeleteObjectInput');
const DeleteViewInput = require('./inputs/DeleteViewInput');

const ExportInput = require('./inputs/ExportInput');
const ExportStatusInput = require('./inputs/ExportStatusInput');

const QueryImageInput = require('./inputs/QueryImageInput');
const QueryImagesInput = require('./inputs/QueryImagesInput');
const QueryStatsInput = require('./inputs/QueryStatsInput');

const RegisterCameraInput = require('./inputs/RegisterCameraInput');
const UnregisterCameraInput = require('./inputs/UnregisterCameraInput');

const UpdateDeploymentInput = require('./inputs/UpdateDeploymentInput');
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
const MLModel = require('./objects/MLModel');
const PageInfo = require('./objects/PageInfo');
const Project = require('./objects/Project');
const Scalars = require('./objects/Scalars');
const View = require('./objects/View');

const CreateDeploymentPayload = require('./payloads/CreateDeploymentPayload');
const CreateImagePayload = require('./payloads/CreateImagePayload');
const CreateLabelsPayload = require('./payloads/CreateLabelsPayload');
const CreateObjectPayload = require('./payloads/CreateObjectPayload');
const CreateViewPayload = require('./payloads/CreateViewPayload');

const DeleteDeploymentPayload = require('./payloads/DeleteDeploymentPayload');
const DeleteLabelPayload = require('./payloads/DeleteLabelPayload');
const DeleteObjectPayload = require('./payloads/DeleteObjectPayload');
const DeleteViewPayload = require('./payloads/DeleteViewPayload');

const ExportPayload = require('./payloads/ExportPayload');
const ExportStatusPayload = require('./payloads/ExportStatusPayload');

const ImagesConnection = require('./payloads/ImagesConnection');
const ImagesStats = require('./payloads/ImagesStats');

const RegisterCameraPayload = require('./payloads/RegisterCameraPayload');
const UnregisterCameraPayload = require('./payloads/UnregisterCameraPayload');

const UpdateDeploymentPayload = require('./payloads/UpdateDeploymentPayload');
const UpdateLabelPayload = require('./payloads/UpdateLabelPayload');
const UpdateObjectPayload = require('./payloads/UpdateObjectPayload');
// const UpdateObjectsPayload = require('./payloads/UpdateObjectsPayload');
const UpdateViewPayload = require('./payloads/UpdateViewPayload');

const Mutation = require('./root/Mutation');
const Query = require('./root/Query');

// TODO: replace this nightmare with @graphql-tools/merge utility 
// https://www.npmjs.com/package/@graphql-tools/merge

// TODO: follow shopify naming convention for type-defs & resolvers: 
// 'ImageCreateInput' rather than 'CreateImageInput' for alphabetical grouping  
// by DB collection/schema type 

const typeDefStrings = [
  CreateDeploymentInput,
  CreateImageInput,
  CreateLabelsInput,
  CreateObjectInput,
  CreateViewInput,
  DeleteDeploymentInput,
  DeleteLabelInput,
  DeleteObjectInput,
  DeleteViewInput,
  ExportInput,
  ExportStatusInput,
  QueryImageInput,
  QueryImagesInput,
  QueryStatsInput,
  RegisterCameraInput,
  UnregisterCameraInput,
  UpdateDeploymentInput,
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
  MLModel,
  PageInfo,
  Project,
  Scalars,
  View,
  CreateDeploymentPayload,
  CreateImagePayload,
  CreateLabelsPayload,
  CreateObjectPayload,
  CreateViewPayload,
  DeleteDeploymentPayload,
  DeleteLabelPayload,
  DeleteObjectPayload,
  DeleteViewPayload,
  ExportPayload,
  ExportStatusPayload,
  ImagesConnection,
  ImagesStats,
  RegisterCameraPayload,
  UnregisterCameraPayload,
  UpdateDeploymentPayload,
  UpdateLabelPayload,
  UpdateObjectPayload,
  // UpdateObjectsPayload,
  UpdateViewPayload,
  Mutation,
  Query
];

const typeDefs = typeDefStrings.join('');

module.exports = typeDefs;
