import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Date: { input: any; output: any; }
  JSONObject: { input: any; output: any; }
};

export type AutomationAction = {
  __typename?: 'AutomationAction';
  alertRecipients?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  categoryConfig?: Maybe<Scalars['JSONObject']['output']>;
  confThreshold?: Maybe<Scalars['Float']['output']>;
  mlModel?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
};

export type AutomationActionInput = {
  alertRecipients?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  categoryConfig?: InputMaybe<Scalars['JSONObject']['input']>;
  confThreshold?: InputMaybe<Scalars['Float']['input']>;
  mlModel?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};

export type AutomationEvent = {
  __typename?: 'AutomationEvent';
  label?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
};

export type AutomationEventInput = {
  label?: InputMaybe<Scalars['String']['input']>;
  type: Scalars['String']['input'];
};

export type AutomationRule = {
  __typename?: 'AutomationRule';
  _id: Scalars['ID']['output'];
  action: AutomationAction;
  event: AutomationEvent;
  name: Scalars['String']['output'];
};

export type AutomationRuleInput = {
  _id?: InputMaybe<Scalars['ID']['input']>;
  action: AutomationActionInput;
  event: AutomationEventInput;
  name: Scalars['String']['input'];
};

export type Batch = {
  __typename?: 'Batch';
  _id: Scalars['String']['output'];
  created?: Maybe<Scalars['Date']['output']>;
  dead?: Maybe<Scalars['Int']['output']>;
  errors?: Maybe<Array<Maybe<BatchError>>>;
  imageErrors?: Maybe<Scalars['Int']['output']>;
  ingestionComplete?: Maybe<Scalars['Date']['output']>;
  originalFile?: Maybe<Scalars['String']['output']>;
  overrideSerial?: Maybe<Scalars['String']['output']>;
  processingEnd?: Maybe<Scalars['Date']['output']>;
  processingStart?: Maybe<Scalars['Date']['output']>;
  projectId: Scalars['String']['output'];
  remaining?: Maybe<Scalars['Int']['output']>;
  stoppingInitiated?: Maybe<Scalars['Date']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
  uploadComplete?: Maybe<Scalars['Date']['output']>;
  uploadedFile?: Maybe<Scalars['String']['output']>;
};

export type BatchError = {
  __typename?: 'BatchError';
  _id: Scalars['String']['output'];
  batch: Scalars['String']['output'];
  created: Scalars['Date']['output'];
  error: Scalars['String']['output'];
};

export type BatchPayload = {
  __typename?: 'BatchPayload';
  batch?: Maybe<Batch>;
};

export type BatchesConnection = {
  __typename?: 'BatchesConnection';
  batches: Array<Maybe<Batch>>;
  pageInfo?: Maybe<PageInfo>;
};

export type CameraConfig = {
  __typename?: 'CameraConfig';
  _id: Scalars['String']['output'];
  deployments: Array<Deployment>;
};

export type Categories = {
  __typename?: 'Categories';
  _id: Scalars['String']['output'];
  color: Scalars['String']['output'];
  name: Scalars['String']['output'];
};

export type ClearBatchErrorsInput = {
  batch: Scalars['String']['input'];
};

export type ClearImageErrorsInput = {
  batch: Scalars['String']['input'];
};

export type CloseUploadInput = {
  batchId: Scalars['String']['input'];
  multipartUploadId: Scalars['String']['input'];
  parts: Array<InputMaybe<CloseUploadPart>>;
};

export type CloseUploadPart = {
  ETag: Scalars['String']['input'];
  PartNumber: Scalars['Int']['input'];
};

export type CreateBatchErrorInput = {
  batch: Scalars['String']['input'];
  error: Scalars['String']['input'];
};

export type CreateDeploymentInput = {
  cameraId: Scalars['ID']['input'];
  deployment: DeploymentInput;
};

export type CreateImageCommentInput = {
  comment: Scalars['String']['input'];
  imageId: Scalars['ID']['input'];
};

export type CreateImageErrorInput = {
  batch?: InputMaybe<Scalars['String']['input']>;
  error: Scalars['String']['input'];
  image?: InputMaybe<Scalars['String']['input']>;
};

export type CreateImageInput = {
  md: Scalars['JSONObject']['input'];
};

export type CreateImagePayload = {
  __typename?: 'CreateImagePayload';
  imageAttempt?: Maybe<ImageAttempt>;
};

export type CreateInternalLabelInput = {
  bbox: Array<Scalars['Float']['input']>;
  conf?: InputMaybe<Scalars['Float']['input']>;
  imageId?: InputMaybe<Scalars['ID']['input']>;
  labelId: Scalars['String']['input'];
  mlModel: Scalars['String']['input'];
  mlModelVersion: Scalars['String']['input'];
};

export type CreateInternalLabelsInput = {
  labels: Array<InputMaybe<CreateInternalLabelInput>>;
};

export type CreateLabelInput = {
  _id?: InputMaybe<Scalars['ID']['input']>;
  bbox: Array<Scalars['Float']['input']>;
  conf?: InputMaybe<Scalars['Float']['input']>;
  imageId?: InputMaybe<Scalars['ID']['input']>;
  labelId: Scalars['String']['input'];
  labeledDate?: InputMaybe<Scalars['Date']['input']>;
  objectId?: InputMaybe<Scalars['ID']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
  validation?: InputMaybe<ValidationInput>;
};

export type CreateLabelsInput = {
  labels: Array<InputMaybe<CreateLabelInput>>;
};

export type CreateObjectInput = {
  imageId: Scalars['ID']['input'];
  object: ObjectInput;
};

export type CreateObjectsInput = {
  objects: Array<InputMaybe<CreateObjectInput>>;
};

export type CreateProjectInput = {
  availableMLModels: Array<InputMaybe<Scalars['String']['input']>>;
  description: Scalars['String']['input'];
  name: Scalars['String']['input'];
  timezone: Scalars['String']['input'];
};

export type CreateProjectLabelInput = {
  color: Scalars['String']['input'];
  name: Scalars['String']['input'];
  reviewerEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type CreateUploadInput = {
  originalFile: Scalars['String']['input'];
  partCount?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateUploadPayload = {
  __typename?: 'CreateUploadPayload';
  batch: Scalars['String']['output'];
  multipartUploadId?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
  urls?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  user: Scalars['String']['output'];
};

export type CreateUserInput = {
  roles: Array<InputMaybe<UserRole>>;
  username: Scalars['String']['input'];
};

export type CreateViewInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  editable: Scalars['Boolean']['input'];
  filters: FiltersInput;
  name: Scalars['String']['input'];
};

export type CreateViewPayload = {
  __typename?: 'CreateViewPayload';
  view?: Maybe<View>;
};

export type DeleteDeploymentInput = {
  cameraId: Scalars['ID']['input'];
  deploymentId: Scalars['ID']['input'];
};

export type DeleteImageCommentInput = {
  id: Scalars['String']['input'];
  imageId: Scalars['ID']['input'];
};

export type DeleteImagesInput = {
  imageIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type DeleteLabelInput = {
  imageId: Scalars['ID']['input'];
  labelId: Scalars['ID']['input'];
  objectId: Scalars['ID']['input'];
};

export type DeleteLabelsInput = {
  labels: Array<InputMaybe<DeleteLabelInput>>;
};

export type DeleteObjectInput = {
  imageId: Scalars['ID']['input'];
  objectId: Scalars['ID']['input'];
};

export type DeleteObjectsInput = {
  objects: Array<InputMaybe<DeleteObjectInput>>;
};

export type DeleteProjectLabelInput = {
  _id: Scalars['ID']['input'];
};

export type DeleteViewInput = {
  viewId: Scalars['ID']['input'];
};

export type DeleteViewPayload = {
  __typename?: 'DeleteViewPayload';
  project?: Maybe<Project>;
};

export type Deployment = {
  __typename?: 'Deployment';
  _id: Scalars['ID']['output'];
  description?: Maybe<Scalars['String']['output']>;
  editable?: Maybe<Scalars['Boolean']['output']>;
  location?: Maybe<Location>;
  name: Scalars['String']['output'];
  startDate?: Maybe<Scalars['Date']['output']>;
  timezone: Scalars['String']['output'];
};

export type DeploymentDiffsInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  editable?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<LocationInput>;
  name?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['Date']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type DeploymentInput = {
  _id: Scalars['ID']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  editable?: InputMaybe<Scalars['Boolean']['input']>;
  location?: InputMaybe<LocationInput>;
  name: Scalars['String']['input'];
  startDate: Scalars['Date']['input'];
  timezone: Scalars['String']['input'];
};

export type ExportError = {
  __typename?: 'ExportError';
  message?: Maybe<Scalars['String']['output']>;
};

export type ExportPayload = {
  __typename?: 'ExportPayload';
  documentId: Scalars['ID']['output'];
};

export type ExportStatusPayload = {
  __typename?: 'ExportStatusPayload';
  count?: Maybe<Scalars['Int']['output']>;
  error?: Maybe<Array<Maybe<ExportError>>>;
  meta?: Maybe<Scalars['JSONObject']['output']>;
  status: Scalars['String']['output'];
  url?: Maybe<Scalars['String']['output']>;
};

export type Filters = {
  __typename?: 'Filters';
  addedEnd?: Maybe<Scalars['Date']['output']>;
  addedStart?: Maybe<Scalars['Date']['output']>;
  cameras?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  createdEnd?: Maybe<Scalars['Date']['output']>;
  createdStart?: Maybe<Scalars['Date']['output']>;
  custom?: Maybe<Scalars['String']['output']>;
  deployments?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  labels?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  notReviewed?: Maybe<Scalars['Boolean']['output']>;
  reviewed?: Maybe<Scalars['Boolean']['output']>;
};

export type FiltersInput = {
  addedEnd?: InputMaybe<Scalars['Date']['input']>;
  addedStart?: InputMaybe<Scalars['Date']['input']>;
  cameras?: InputMaybe<Array<Scalars['String']['input']>>;
  createdEnd?: InputMaybe<Scalars['Date']['input']>;
  createdStart?: InputMaybe<Scalars['Date']['input']>;
  custom?: InputMaybe<Scalars['String']['input']>;
  deployments?: InputMaybe<Array<Scalars['String']['input']>>;
  labels?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  reviewed?: InputMaybe<Scalars['Boolean']['input']>;
};

export enum Format {
  Coco = 'coco',
  Csv = 'csv'
}

export type Image = {
  __typename?: 'Image';
  _id: Scalars['ID']['output'];
  batchId?: Maybe<Scalars['String']['output']>;
  bucket: Scalars['String']['output'];
  cameraId: Scalars['String']['output'];
  comments?: Maybe<Array<Maybe<ImageComment>>>;
  dateAdded: Scalars['Date']['output'];
  dateTimeOriginal: Scalars['Date']['output'];
  deploymentId: Scalars['ID']['output'];
  errors?: Maybe<Array<Maybe<ImageError>>>;
  fileTypeExtension: Scalars['String']['output'];
  imageBytes?: Maybe<Scalars['Int']['output']>;
  imageHeight?: Maybe<Scalars['Int']['output']>;
  imageWidth?: Maybe<Scalars['Int']['output']>;
  location?: Maybe<Location>;
  make: Scalars['String']['output'];
  mimeType?: Maybe<Scalars['String']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  objects?: Maybe<Array<Maybe<Object>>>;
  originalFileName?: Maybe<Scalars['String']['output']>;
  path?: Maybe<Scalars['String']['output']>;
  projectId: Scalars['String']['output'];
  reviewed?: Maybe<Scalars['Boolean']['output']>;
  timezone: Scalars['String']['output'];
  userSetData?: Maybe<Scalars['JSONObject']['output']>;
};

export type ImageAttempt = {
  __typename?: 'ImageAttempt';
  _id: Scalars['ID']['output'];
  batch?: Maybe<Scalars['String']['output']>;
  created: Scalars['Date']['output'];
  errors?: Maybe<Array<Maybe<ImageError>>>;
  metadata?: Maybe<ImageMetadata>;
  projectId: Scalars['String']['output'];
};

export type ImageComment = {
  __typename?: 'ImageComment';
  _id: Scalars['ID']['output'];
  author: Scalars['String']['output'];
  comment: Scalars['String']['output'];
  created: Scalars['Date']['output'];
};

export type ImageCommentsPayload = {
  __typename?: 'ImageCommentsPayload';
  comments?: Maybe<Array<Maybe<ImageComment>>>;
};

export type ImageError = {
  __typename?: 'ImageError';
  _id: Scalars['String']['output'];
  batch?: Maybe<Scalars['String']['output']>;
  created: Scalars['Date']['output'];
  error: Scalars['String']['output'];
  image?: Maybe<Scalars['String']['output']>;
  path?: Maybe<Scalars['String']['output']>;
};

export type ImageErrorsConnection = {
  __typename?: 'ImageErrorsConnection';
  errors: Array<Maybe<ImageError>>;
  pageInfo?: Maybe<PageInfo>;
};

export type ImageErrorsFilterInput = {
  batch: Scalars['String']['input'];
};

export type ImageMetadata = {
  __typename?: 'ImageMetadata';
  _id: Scalars['ID']['output'];
  batchId?: Maybe<Scalars['String']['output']>;
  bucket?: Maybe<Scalars['String']['output']>;
  cameraId?: Maybe<Scalars['String']['output']>;
  dateAdded?: Maybe<Scalars['Date']['output']>;
  dateTimeOriginal?: Maybe<Scalars['Date']['output']>;
  fileTypeExtension?: Maybe<Scalars['String']['output']>;
  imageBytes?: Maybe<Scalars['Int']['output']>;
  imageHeight?: Maybe<Scalars['Int']['output']>;
  imageWidth?: Maybe<Scalars['Int']['output']>;
  make?: Maybe<Scalars['String']['output']>;
  mimeType?: Maybe<Scalars['String']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  originalFileName?: Maybe<Scalars['String']['output']>;
  path?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
};

export type ImagesConnection = {
  __typename?: 'ImagesConnection';
  images: Array<Maybe<Image>>;
  pageInfo?: Maybe<PageInfo>;
};

export type ImagesCount = {
  __typename?: 'ImagesCount';
  count?: Maybe<Scalars['Int']['output']>;
};

export type Label = {
  __typename?: 'Label';
  _id: Scalars['ID']['output'];
  bbox: Array<Scalars['Float']['output']>;
  conf?: Maybe<Scalars['Float']['output']>;
  labelId: Scalars['String']['output'];
  labeledDate: Scalars['Date']['output'];
  mlModel?: Maybe<Scalars['String']['output']>;
  mlModelVersion?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
  userId?: Maybe<Scalars['ID']['output']>;
  validation?: Maybe<Validation>;
};

export type LabelDiffsInput = {
  locked?: InputMaybe<Scalars['Boolean']['input']>;
  validation?: InputMaybe<ValidationInput>;
};

export type LabelList = {
  __typename?: 'LabelList';
  categories?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
};

export type LabelUpdate = {
  diffs: LabelDiffsInput;
  imageId: Scalars['ID']['input'];
  labelId: Scalars['ID']['input'];
  objectId: Scalars['ID']['input'];
};

export type Location = {
  __typename?: 'Location';
  _id: Scalars['ID']['output'];
  altitude?: Maybe<Scalars['String']['output']>;
  geometry: Point;
  name?: Maybe<Scalars['String']['output']>;
};

export type LocationInput = {
  _id: Scalars['ID']['input'];
  altitude?: InputMaybe<Scalars['String']['input']>;
  geometry: PointInput;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type MlModel = {
  __typename?: 'MLModel';
  _id: Scalars['String']['output'];
  categories?: Maybe<Array<Maybe<Categories>>>;
  defaultConfThreshold?: Maybe<Scalars['Float']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  version: Scalars['String']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  clearBatchErrors?: Maybe<StandardPayload>;
  clearImageErrors?: Maybe<StandardPayload>;
  closeUpload?: Maybe<StandardPayload>;
  createBatchError?: Maybe<BatchError>;
  createDeployment?: Maybe<Task>;
  createImage?: Maybe<CreateImagePayload>;
  createImageComment?: Maybe<ImageCommentsPayload>;
  createImageError?: Maybe<ImageError>;
  createInternalLabels?: Maybe<StandardPayload>;
  createLabels?: Maybe<StandardPayload>;
  createObjects?: Maybe<StandardPayload>;
  createProject?: Maybe<ProjectPayload>;
  createProjectLabel?: Maybe<ProjectLabelPayload>;
  createUpload?: Maybe<CreateUploadPayload>;
  createUser?: Maybe<StandardPayload>;
  createView?: Maybe<CreateViewPayload>;
  deleteDeployment?: Maybe<Task>;
  deleteImageComment?: Maybe<ImageCommentsPayload>;
  deleteImages?: Maybe<StandardErrorPayload>;
  deleteLabels?: Maybe<StandardPayload>;
  deleteObjects?: Maybe<StandardPayload>;
  deleteProjectLabel?: Maybe<StandardPayload>;
  deleteView?: Maybe<DeleteViewPayload>;
  redriveBatch?: Maybe<StandardPayload>;
  registerCamera?: Maybe<RegisterCameraPayload>;
  stopBatch?: Maybe<StandardPayload>;
  unregisterCamera?: Maybe<UnregisterCameraPayload>;
  updateAutomationRules?: Maybe<UpdateAutomationRulesPayload>;
  updateBatch?: Maybe<BatchPayload>;
  updateDeployment?: Maybe<Task>;
  updateImageComment?: Maybe<ImageCommentsPayload>;
  updateLabels?: Maybe<StandardPayload>;
  updateObjects?: Maybe<StandardPayload>;
  updateProject?: Maybe<ProjectPayload>;
  updateProjectLabel?: Maybe<ProjectLabelPayload>;
  updateUser?: Maybe<StandardPayload>;
  updateView?: Maybe<UpdateViewPayload>;
};


export type MutationClearBatchErrorsArgs = {
  input: ClearBatchErrorsInput;
};


export type MutationClearImageErrorsArgs = {
  input: ClearImageErrorsInput;
};


export type MutationCloseUploadArgs = {
  input: CloseUploadInput;
};


export type MutationCreateBatchErrorArgs = {
  input: CreateBatchErrorInput;
};


export type MutationCreateDeploymentArgs = {
  input: CreateDeploymentInput;
};


export type MutationCreateImageArgs = {
  input: CreateImageInput;
};


export type MutationCreateImageCommentArgs = {
  input: CreateImageCommentInput;
};


export type MutationCreateImageErrorArgs = {
  input: CreateImageErrorInput;
};


export type MutationCreateInternalLabelsArgs = {
  input: CreateInternalLabelsInput;
};


export type MutationCreateLabelsArgs = {
  input: CreateLabelsInput;
};


export type MutationCreateObjectsArgs = {
  input: CreateObjectsInput;
};


export type MutationCreateProjectArgs = {
  input: CreateProjectInput;
};


export type MutationCreateProjectLabelArgs = {
  input: CreateProjectLabelInput;
};


export type MutationCreateUploadArgs = {
  input: CreateUploadInput;
};


export type MutationCreateUserArgs = {
  input: CreateUserInput;
};


export type MutationCreateViewArgs = {
  input: CreateViewInput;
};


export type MutationDeleteDeploymentArgs = {
  input: DeleteDeploymentInput;
};


export type MutationDeleteImageCommentArgs = {
  input: DeleteImageCommentInput;
};


export type MutationDeleteImagesArgs = {
  input: DeleteImagesInput;
};


export type MutationDeleteLabelsArgs = {
  input: DeleteLabelsInput;
};


export type MutationDeleteObjectsArgs = {
  input: DeleteObjectsInput;
};


export type MutationDeleteProjectLabelArgs = {
  input: DeleteProjectLabelInput;
};


export type MutationDeleteViewArgs = {
  input: DeleteViewInput;
};


export type MutationRedriveBatchArgs = {
  input: RedriveBatchInput;
};


export type MutationRegisterCameraArgs = {
  input: RegisterCameraInput;
};


export type MutationStopBatchArgs = {
  input: StopBatchInput;
};


export type MutationUnregisterCameraArgs = {
  input: UnregisterCameraInput;
};


export type MutationUpdateAutomationRulesArgs = {
  input: UpdateAutomationRulesInput;
};


export type MutationUpdateBatchArgs = {
  input: UpdateBatchInput;
};


export type MutationUpdateDeploymentArgs = {
  input: UpdateDeploymentInput;
};


export type MutationUpdateImageCommentArgs = {
  input: UpdateImageCommentInput;
};


export type MutationUpdateLabelsArgs = {
  input: UpdateLabelsInput;
};


export type MutationUpdateObjectsArgs = {
  input: UpdateObjectsInput;
};


export type MutationUpdateProjectArgs = {
  input: UpdateProjectInput;
};


export type MutationUpdateProjectLabelArgs = {
  input: UpdateProjectLabelInput;
};


export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};


export type MutationUpdateViewArgs = {
  input: UpdateViewInput;
};

export type Object = {
  __typename?: 'Object';
  _id: Scalars['ID']['output'];
  bbox?: Maybe<Array<Scalars['Float']['output']>>;
  labels?: Maybe<Array<Maybe<Label>>>;
  locked: Scalars['Boolean']['output'];
};

export type ObjectDiffsInput = {
  bbox?: InputMaybe<Array<Scalars['Float']['input']>>;
  locked?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ObjectInput = {
  _id: Scalars['ID']['input'];
  bbox?: InputMaybe<Array<Scalars['Float']['input']>>;
  labels?: InputMaybe<Array<InputMaybe<CreateLabelInput>>>;
  locked: Scalars['Boolean']['input'];
};

export type ObjectUpdate = {
  diffs: ObjectDiffsInput;
  imageId: Scalars['ID']['input'];
  objectId: Scalars['ID']['input'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  hasNext?: Maybe<Scalars['Boolean']['output']>;
  hasPrevious?: Maybe<Scalars['Boolean']['output']>;
  next?: Maybe<Scalars['String']['output']>;
  previous?: Maybe<Scalars['String']['output']>;
};

export type Point = {
  __typename?: 'Point';
  coordinates: Array<Scalars['Float']['output']>;
  type: Scalars['String']['output'];
};

export type PointInput = {
  coordinates: Array<Scalars['Float']['input']>;
  type: Scalars['String']['input'];
};

export type Project = {
  __typename?: 'Project';
  _id: Scalars['String']['output'];
  automationRules?: Maybe<Array<Maybe<AutomationRule>>>;
  availableMLModels?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  cameraConfigs?: Maybe<Array<Maybe<CameraConfig>>>;
  description?: Maybe<Scalars['String']['output']>;
  labels?: Maybe<Array<Maybe<ProjectLabel>>>;
  name: Scalars['String']['output'];
  timezone: Scalars['String']['output'];
  views: Array<View>;
};

export type ProjectLabel = {
  __typename?: 'ProjectLabel';
  _id: Scalars['String']['output'];
  color: Scalars['String']['output'];
  name: Scalars['String']['output'];
  reviewerEnabled: Scalars['Boolean']['output'];
};

export type ProjectLabelPayload = {
  __typename?: 'ProjectLabelPayload';
  label?: Maybe<ProjectLabel>;
};

export type ProjectPayload = {
  __typename?: 'ProjectPayload';
  project?: Maybe<Project>;
};

export type ProjectRegistration = {
  __typename?: 'ProjectRegistration';
  _id: Scalars['ID']['output'];
  active: Scalars['Boolean']['output'];
  projectId: Scalars['String']['output'];
};

export type Query = {
  __typename?: 'Query';
  batches?: Maybe<BatchesConnection>;
  exportAnnotations?: Maybe<Task>;
  exportErrors?: Maybe<Task>;
  image?: Maybe<Image>;
  imageErrors?: Maybe<ImageErrorsConnection>;
  images?: Maybe<ImagesConnection>;
  imagesCount?: Maybe<ImagesCount>;
  labels?: Maybe<LabelList>;
  mlModels?: Maybe<Array<Maybe<MlModel>>>;
  projects?: Maybe<Array<Maybe<Project>>>;
  stats?: Maybe<Task>;
  task?: Maybe<Task>;
  tasks?: Maybe<TasksPayload>;
  users?: Maybe<UsersPayload>;
  wirelessCameras?: Maybe<Array<Maybe<WirelessCamera>>>;
};


export type QueryBatchesArgs = {
  input: QueryBatchesInput;
};


export type QueryExportAnnotationsArgs = {
  input: QueryExportAnnotationsInput;
};


export type QueryExportErrorsArgs = {
  input: QueryExportErrorsInput;
};


export type QueryImageArgs = {
  input: QueryImageInput;
};


export type QueryImageErrorsArgs = {
  input: QueryImageErrorsInput;
};


export type QueryImagesArgs = {
  input: QueryImagesInput;
};


export type QueryImagesCountArgs = {
  input: QueryImagesCountInput;
};


export type QueryMlModelsArgs = {
  input?: InputMaybe<QueryMlModelsInput>;
};


export type QueryProjectsArgs = {
  input?: InputMaybe<QueryProjectsInput>;
};


export type QueryStatsArgs = {
  input: QueryStatsInput;
};


export type QueryTaskArgs = {
  input: QueryTaskInput;
};


export type QueryTasksArgs = {
  input?: InputMaybe<QueryTasksInput>;
};


export type QueryUsersArgs = {
  input?: InputMaybe<QueryUsersInput>;
};


export type QueryWirelessCamerasArgs = {
  input?: InputMaybe<QueryWirelessCamerasInput>;
};

export type QueryBatchesInput = {
  filter?: InputMaybe<FilterEnum>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  next?: InputMaybe<Scalars['String']['input']>;
  paginatedField?: InputMaybe<Scalars['String']['input']>;
  previous?: InputMaybe<Scalars['String']['input']>;
  sortAscending?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryExportAnnotationsInput = {
  filters: FiltersInput;
  format: Format;
};

export type QueryExportErrorsInput = {
  filters: ImageErrorsFilterInput;
};

export type QueryImageErrorsInput = {
  filters: ImageErrorsFilterInput;
  limit?: InputMaybe<Scalars['Int']['input']>;
  next?: InputMaybe<Scalars['String']['input']>;
  paginatedField?: InputMaybe<Scalars['String']['input']>;
  previous?: InputMaybe<Scalars['String']['input']>;
  sortAscending?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryImageInput = {
  imageId: Scalars['ID']['input'];
};

export type QueryImagesCountInput = {
  filters: FiltersInput;
};

export type QueryImagesInput = {
  filters: FiltersInput;
  limit?: InputMaybe<Scalars['Int']['input']>;
  next?: InputMaybe<Scalars['String']['input']>;
  paginatedField?: InputMaybe<Scalars['String']['input']>;
  previous?: InputMaybe<Scalars['String']['input']>;
  sortAscending?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryMlModelsInput = {
  _ids?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type QueryProjectsInput = {
  _ids?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type QueryStatsInput = {
  filters: FiltersInput;
};

export type QueryTaskInput = {
  taskId: Scalars['ID']['input'];
};

export type QueryTasksInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  next?: InputMaybe<Scalars['String']['input']>;
  paginatedField?: InputMaybe<Scalars['String']['input']>;
  previous?: InputMaybe<Scalars['String']['input']>;
  sortAscending?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QueryUsersInput = {
  filter?: InputMaybe<Scalars['String']['input']>;
};

export type QueryWirelessCamerasInput = {
  _ids?: InputMaybe<Array<Scalars['String']['input']>>;
};

export type RedriveBatchInput = {
  batch?: InputMaybe<Scalars['String']['input']>;
};

export type RegisterCameraInput = {
  cameraId: Scalars['ID']['input'];
  make: Scalars['String']['input'];
};

export type RegisterCameraPayload = {
  __typename?: 'RegisterCameraPayload';
  project?: Maybe<Project>;
  wirelessCameras?: Maybe<Array<Maybe<WirelessCamera>>>;
};

export type StandardErrorPayload = {
  __typename?: 'StandardErrorPayload';
  errors?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  isOk?: Maybe<Scalars['Boolean']['output']>;
};

export type StandardPayload = {
  __typename?: 'StandardPayload';
  isOk?: Maybe<Scalars['Boolean']['output']>;
};

export type StopBatchInput = {
  batch: Scalars['String']['input'];
};

export type Task = {
  __typename?: 'Task';
  _id: Scalars['ID']['output'];
  created: Scalars['Date']['output'];
  output?: Maybe<Scalars['JSONObject']['output']>;
  projectId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  type: Scalars['String']['output'];
  updated: Scalars['Date']['output'];
  user: Scalars['String']['output'];
};

export type TasksPayload = {
  __typename?: 'TasksPayload';
  tasks: Array<Maybe<Task>>;
};

export type UnregisterCameraInput = {
  cameraId: Scalars['ID']['input'];
};

export type UnregisterCameraPayload = {
  __typename?: 'UnregisterCameraPayload';
  project?: Maybe<Project>;
  wirelessCameras?: Maybe<Array<Maybe<WirelessCamera>>>;
};

export type UpdateAutomationRulesInput = {
  automationRules?: InputMaybe<Array<InputMaybe<AutomationRuleInput>>>;
};

export type UpdateAutomationRulesPayload = {
  __typename?: 'UpdateAutomationRulesPayload';
  automationRules?: Maybe<Array<Maybe<AutomationRule>>>;
};

export type UpdateBatchInput = {
  _id: Scalars['String']['input'];
  ingestionComplete?: InputMaybe<Scalars['Date']['input']>;
  originalFile?: InputMaybe<Scalars['String']['input']>;
  overrideSerial?: InputMaybe<Scalars['String']['input']>;
  processingEnd?: InputMaybe<Scalars['Date']['input']>;
  processingStart?: InputMaybe<Scalars['Date']['input']>;
  total?: InputMaybe<Scalars['Int']['input']>;
  uploadComplete?: InputMaybe<Scalars['Date']['input']>;
  uploadedFile?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateDeploymentInput = {
  cameraId: Scalars['ID']['input'];
  deploymentId: Scalars['ID']['input'];
  diffs: DeploymentDiffsInput;
};

export type UpdateImageCommentInput = {
  comment: Scalars['String']['input'];
  id: Scalars['String']['input'];
  imageId: Scalars['ID']['input'];
};

export type UpdateLabelsInput = {
  updates: Array<InputMaybe<LabelUpdate>>;
};

export type UpdateObjectsInput = {
  updates: Array<InputMaybe<ObjectUpdate>>;
};

export type UpdateProjectInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateProjectLabelInput = {
  _id: Scalars['ID']['input'];
  color: Scalars['String']['input'];
  name: Scalars['String']['input'];
  reviewerEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateUserInput = {
  roles: Array<InputMaybe<UserRole>>;
  username: Scalars['String']['input'];
};

export type UpdateViewInput = {
  diffs: ViewDiffsInput;
  viewId: Scalars['ID']['input'];
};

export type UpdateViewPayload = {
  __typename?: 'UpdateViewPayload';
  view?: Maybe<View>;
};

export type User = {
  __typename?: 'User';
  created: Scalars['String']['output'];
  email: Scalars['String']['output'];
  enabled: Scalars['Boolean']['output'];
  roles: Array<Maybe<UserRole>>;
  status: Scalars['String']['output'];
  updated: Scalars['String']['output'];
  username: Scalars['String']['output'];
};

export enum UserRole {
  Manager = 'manager',
  Member = 'member',
  Observer = 'observer'
}

export type UsersPayload = {
  __typename?: 'UsersPayload';
  users: Array<Maybe<User>>;
};

export type Validation = {
  __typename?: 'Validation';
  userId: Scalars['ID']['output'];
  validated: Scalars['Boolean']['output'];
  validationDate: Scalars['Date']['output'];
};

export type ValidationInput = {
  userId: Scalars['ID']['input'];
  validated: Scalars['Boolean']['input'];
  validationDate?: InputMaybe<Scalars['Date']['input']>;
};

export type View = {
  __typename?: 'View';
  _id: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  editable: Scalars['Boolean']['output'];
  filters: Filters;
  name: Scalars['String']['output'];
};

export type ViewDiffsInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  filters?: InputMaybe<FiltersInput>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type WirelessCamera = {
  __typename?: 'WirelessCamera';
  _id: Scalars['String']['output'];
  make: Scalars['String']['output'];
  model?: Maybe<Scalars['String']['output']>;
  projRegistrations: Array<ProjectRegistration>;
};

export enum FilterEnum {
  Completed = 'COMPLETED',
  Current = 'CURRENT'
}



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AutomationAction: ResolverTypeWrapper<AutomationAction>;
  AutomationActionInput: AutomationActionInput;
  AutomationEvent: ResolverTypeWrapper<AutomationEvent>;
  AutomationEventInput: AutomationEventInput;
  AutomationRule: ResolverTypeWrapper<AutomationRule>;
  AutomationRuleInput: AutomationRuleInput;
  Batch: ResolverTypeWrapper<Batch>;
  BatchError: ResolverTypeWrapper<BatchError>;
  BatchPayload: ResolverTypeWrapper<BatchPayload>;
  BatchesConnection: ResolverTypeWrapper<BatchesConnection>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CameraConfig: ResolverTypeWrapper<CameraConfig>;
  Categories: ResolverTypeWrapper<Categories>;
  ClearBatchErrorsInput: ClearBatchErrorsInput;
  ClearImageErrorsInput: ClearImageErrorsInput;
  CloseUploadInput: CloseUploadInput;
  CloseUploadPart: CloseUploadPart;
  CreateBatchErrorInput: CreateBatchErrorInput;
  CreateDeploymentInput: CreateDeploymentInput;
  CreateImageCommentInput: CreateImageCommentInput;
  CreateImageErrorInput: CreateImageErrorInput;
  CreateImageInput: CreateImageInput;
  CreateImagePayload: ResolverTypeWrapper<CreateImagePayload>;
  CreateInternalLabelInput: CreateInternalLabelInput;
  CreateInternalLabelsInput: CreateInternalLabelsInput;
  CreateLabelInput: CreateLabelInput;
  CreateLabelsInput: CreateLabelsInput;
  CreateObjectInput: CreateObjectInput;
  CreateObjectsInput: CreateObjectsInput;
  CreateProjectInput: CreateProjectInput;
  CreateProjectLabelInput: CreateProjectLabelInput;
  CreateUploadInput: CreateUploadInput;
  CreateUploadPayload: ResolverTypeWrapper<CreateUploadPayload>;
  CreateUserInput: CreateUserInput;
  CreateViewInput: CreateViewInput;
  CreateViewPayload: ResolverTypeWrapper<CreateViewPayload>;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DeleteDeploymentInput: DeleteDeploymentInput;
  DeleteImageCommentInput: DeleteImageCommentInput;
  DeleteImagesInput: DeleteImagesInput;
  DeleteLabelInput: DeleteLabelInput;
  DeleteLabelsInput: DeleteLabelsInput;
  DeleteObjectInput: DeleteObjectInput;
  DeleteObjectsInput: DeleteObjectsInput;
  DeleteProjectLabelInput: DeleteProjectLabelInput;
  DeleteViewInput: DeleteViewInput;
  DeleteViewPayload: ResolverTypeWrapper<DeleteViewPayload>;
  Deployment: ResolverTypeWrapper<Deployment>;
  DeploymentDiffsInput: DeploymentDiffsInput;
  DeploymentInput: DeploymentInput;
  ExportError: ResolverTypeWrapper<ExportError>;
  ExportPayload: ResolverTypeWrapper<ExportPayload>;
  ExportStatusPayload: ResolverTypeWrapper<ExportStatusPayload>;
  Filters: ResolverTypeWrapper<Filters>;
  FiltersInput: FiltersInput;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  Format: Format;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Image: ResolverTypeWrapper<Image>;
  ImageAttempt: ResolverTypeWrapper<ImageAttempt>;
  ImageComment: ResolverTypeWrapper<ImageComment>;
  ImageCommentsPayload: ResolverTypeWrapper<ImageCommentsPayload>;
  ImageError: ResolverTypeWrapper<ImageError>;
  ImageErrorsConnection: ResolverTypeWrapper<ImageErrorsConnection>;
  ImageErrorsFilterInput: ImageErrorsFilterInput;
  ImageMetadata: ResolverTypeWrapper<ImageMetadata>;
  ImagesConnection: ResolverTypeWrapper<ImagesConnection>;
  ImagesCount: ResolverTypeWrapper<ImagesCount>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']['output']>;
  Label: ResolverTypeWrapper<Label>;
  LabelDiffsInput: LabelDiffsInput;
  LabelList: ResolverTypeWrapper<LabelList>;
  LabelUpdate: LabelUpdate;
  Location: ResolverTypeWrapper<Location>;
  LocationInput: LocationInput;
  MLModel: ResolverTypeWrapper<MlModel>;
  Mutation: ResolverTypeWrapper<{}>;
  Object: ResolverTypeWrapper<Object>;
  ObjectDiffsInput: ObjectDiffsInput;
  ObjectInput: ObjectInput;
  ObjectUpdate: ObjectUpdate;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Point: ResolverTypeWrapper<Point>;
  PointInput: PointInput;
  Project: ResolverTypeWrapper<Project>;
  ProjectLabel: ResolverTypeWrapper<ProjectLabel>;
  ProjectLabelPayload: ResolverTypeWrapper<ProjectLabelPayload>;
  ProjectPayload: ResolverTypeWrapper<ProjectPayload>;
  ProjectRegistration: ResolverTypeWrapper<ProjectRegistration>;
  Query: ResolverTypeWrapper<{}>;
  QueryBatchesInput: QueryBatchesInput;
  QueryExportAnnotationsInput: QueryExportAnnotationsInput;
  QueryExportErrorsInput: QueryExportErrorsInput;
  QueryImageErrorsInput: QueryImageErrorsInput;
  QueryImageInput: QueryImageInput;
  QueryImagesCountInput: QueryImagesCountInput;
  QueryImagesInput: QueryImagesInput;
  QueryMLModelsInput: QueryMlModelsInput;
  QueryProjectsInput: QueryProjectsInput;
  QueryStatsInput: QueryStatsInput;
  QueryTaskInput: QueryTaskInput;
  QueryTasksInput: QueryTasksInput;
  QueryUsersInput: QueryUsersInput;
  QueryWirelessCamerasInput: QueryWirelessCamerasInput;
  RedriveBatchInput: RedriveBatchInput;
  RegisterCameraInput: RegisterCameraInput;
  RegisterCameraPayload: ResolverTypeWrapper<RegisterCameraPayload>;
  StandardErrorPayload: ResolverTypeWrapper<StandardErrorPayload>;
  StandardPayload: ResolverTypeWrapper<StandardPayload>;
  StopBatchInput: StopBatchInput;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Task: ResolverTypeWrapper<Task>;
  TasksPayload: ResolverTypeWrapper<TasksPayload>;
  UnregisterCameraInput: UnregisterCameraInput;
  UnregisterCameraPayload: ResolverTypeWrapper<UnregisterCameraPayload>;
  UpdateAutomationRulesInput: UpdateAutomationRulesInput;
  UpdateAutomationRulesPayload: ResolverTypeWrapper<UpdateAutomationRulesPayload>;
  UpdateBatchInput: UpdateBatchInput;
  UpdateDeploymentInput: UpdateDeploymentInput;
  UpdateImageCommentInput: UpdateImageCommentInput;
  UpdateLabelsInput: UpdateLabelsInput;
  UpdateObjectsInput: UpdateObjectsInput;
  UpdateProjectInput: UpdateProjectInput;
  UpdateProjectLabelInput: UpdateProjectLabelInput;
  UpdateUserInput: UpdateUserInput;
  UpdateViewInput: UpdateViewInput;
  UpdateViewPayload: ResolverTypeWrapper<UpdateViewPayload>;
  User: ResolverTypeWrapper<User>;
  UserRole: UserRole;
  UsersPayload: ResolverTypeWrapper<UsersPayload>;
  Validation: ResolverTypeWrapper<Validation>;
  ValidationInput: ValidationInput;
  View: ResolverTypeWrapper<View>;
  ViewDiffsInput: ViewDiffsInput;
  WirelessCamera: ResolverTypeWrapper<WirelessCamera>;
  filterEnum: FilterEnum;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AutomationAction: AutomationAction;
  AutomationActionInput: AutomationActionInput;
  AutomationEvent: AutomationEvent;
  AutomationEventInput: AutomationEventInput;
  AutomationRule: AutomationRule;
  AutomationRuleInput: AutomationRuleInput;
  Batch: Batch;
  BatchError: BatchError;
  BatchPayload: BatchPayload;
  BatchesConnection: BatchesConnection;
  Boolean: Scalars['Boolean']['output'];
  CameraConfig: CameraConfig;
  Categories: Categories;
  ClearBatchErrorsInput: ClearBatchErrorsInput;
  ClearImageErrorsInput: ClearImageErrorsInput;
  CloseUploadInput: CloseUploadInput;
  CloseUploadPart: CloseUploadPart;
  CreateBatchErrorInput: CreateBatchErrorInput;
  CreateDeploymentInput: CreateDeploymentInput;
  CreateImageCommentInput: CreateImageCommentInput;
  CreateImageErrorInput: CreateImageErrorInput;
  CreateImageInput: CreateImageInput;
  CreateImagePayload: CreateImagePayload;
  CreateInternalLabelInput: CreateInternalLabelInput;
  CreateInternalLabelsInput: CreateInternalLabelsInput;
  CreateLabelInput: CreateLabelInput;
  CreateLabelsInput: CreateLabelsInput;
  CreateObjectInput: CreateObjectInput;
  CreateObjectsInput: CreateObjectsInput;
  CreateProjectInput: CreateProjectInput;
  CreateProjectLabelInput: CreateProjectLabelInput;
  CreateUploadInput: CreateUploadInput;
  CreateUploadPayload: CreateUploadPayload;
  CreateUserInput: CreateUserInput;
  CreateViewInput: CreateViewInput;
  CreateViewPayload: CreateViewPayload;
  Date: Scalars['Date']['output'];
  DeleteDeploymentInput: DeleteDeploymentInput;
  DeleteImageCommentInput: DeleteImageCommentInput;
  DeleteImagesInput: DeleteImagesInput;
  DeleteLabelInput: DeleteLabelInput;
  DeleteLabelsInput: DeleteLabelsInput;
  DeleteObjectInput: DeleteObjectInput;
  DeleteObjectsInput: DeleteObjectsInput;
  DeleteProjectLabelInput: DeleteProjectLabelInput;
  DeleteViewInput: DeleteViewInput;
  DeleteViewPayload: DeleteViewPayload;
  Deployment: Deployment;
  DeploymentDiffsInput: DeploymentDiffsInput;
  DeploymentInput: DeploymentInput;
  ExportError: ExportError;
  ExportPayload: ExportPayload;
  ExportStatusPayload: ExportStatusPayload;
  Filters: Filters;
  FiltersInput: FiltersInput;
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Image: Image;
  ImageAttempt: ImageAttempt;
  ImageComment: ImageComment;
  ImageCommentsPayload: ImageCommentsPayload;
  ImageError: ImageError;
  ImageErrorsConnection: ImageErrorsConnection;
  ImageErrorsFilterInput: ImageErrorsFilterInput;
  ImageMetadata: ImageMetadata;
  ImagesConnection: ImagesConnection;
  ImagesCount: ImagesCount;
  Int: Scalars['Int']['output'];
  JSONObject: Scalars['JSONObject']['output'];
  Label: Label;
  LabelDiffsInput: LabelDiffsInput;
  LabelList: LabelList;
  LabelUpdate: LabelUpdate;
  Location: Location;
  LocationInput: LocationInput;
  MLModel: MlModel;
  Mutation: {};
  Object: Object;
  ObjectDiffsInput: ObjectDiffsInput;
  ObjectInput: ObjectInput;
  ObjectUpdate: ObjectUpdate;
  PageInfo: PageInfo;
  Point: Point;
  PointInput: PointInput;
  Project: Project;
  ProjectLabel: ProjectLabel;
  ProjectLabelPayload: ProjectLabelPayload;
  ProjectPayload: ProjectPayload;
  ProjectRegistration: ProjectRegistration;
  Query: {};
  QueryBatchesInput: QueryBatchesInput;
  QueryExportAnnotationsInput: QueryExportAnnotationsInput;
  QueryExportErrorsInput: QueryExportErrorsInput;
  QueryImageErrorsInput: QueryImageErrorsInput;
  QueryImageInput: QueryImageInput;
  QueryImagesCountInput: QueryImagesCountInput;
  QueryImagesInput: QueryImagesInput;
  QueryMLModelsInput: QueryMlModelsInput;
  QueryProjectsInput: QueryProjectsInput;
  QueryStatsInput: QueryStatsInput;
  QueryTaskInput: QueryTaskInput;
  QueryTasksInput: QueryTasksInput;
  QueryUsersInput: QueryUsersInput;
  QueryWirelessCamerasInput: QueryWirelessCamerasInput;
  RedriveBatchInput: RedriveBatchInput;
  RegisterCameraInput: RegisterCameraInput;
  RegisterCameraPayload: RegisterCameraPayload;
  StandardErrorPayload: StandardErrorPayload;
  StandardPayload: StandardPayload;
  StopBatchInput: StopBatchInput;
  String: Scalars['String']['output'];
  Task: Task;
  TasksPayload: TasksPayload;
  UnregisterCameraInput: UnregisterCameraInput;
  UnregisterCameraPayload: UnregisterCameraPayload;
  UpdateAutomationRulesInput: UpdateAutomationRulesInput;
  UpdateAutomationRulesPayload: UpdateAutomationRulesPayload;
  UpdateBatchInput: UpdateBatchInput;
  UpdateDeploymentInput: UpdateDeploymentInput;
  UpdateImageCommentInput: UpdateImageCommentInput;
  UpdateLabelsInput: UpdateLabelsInput;
  UpdateObjectsInput: UpdateObjectsInput;
  UpdateProjectInput: UpdateProjectInput;
  UpdateProjectLabelInput: UpdateProjectLabelInput;
  UpdateUserInput: UpdateUserInput;
  UpdateViewInput: UpdateViewInput;
  UpdateViewPayload: UpdateViewPayload;
  User: User;
  UsersPayload: UsersPayload;
  Validation: Validation;
  ValidationInput: ValidationInput;
  View: View;
  ViewDiffsInput: ViewDiffsInput;
  WirelessCamera: WirelessCamera;
};

export type AutomationActionResolvers<ContextType = any, ParentType extends ResolversParentTypes['AutomationAction'] = ResolversParentTypes['AutomationAction']> = {
  alertRecipients?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  categoryConfig?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  confThreshold?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  mlModel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AutomationEventResolvers<ContextType = any, ParentType extends ResolversParentTypes['AutomationEvent'] = ResolversParentTypes['AutomationEvent']> = {
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AutomationRuleResolvers<ContextType = any, ParentType extends ResolversParentTypes['AutomationRule'] = ResolversParentTypes['AutomationRule']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  action?: Resolver<ResolversTypes['AutomationAction'], ParentType, ContextType>;
  event?: Resolver<ResolversTypes['AutomationEvent'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type BatchResolvers<ContextType = any, ParentType extends ResolversParentTypes['Batch'] = ResolversParentTypes['Batch']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  created?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  dead?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  errors?: Resolver<Maybe<Array<Maybe<ResolversTypes['BatchError']>>>, ParentType, ContextType>;
  imageErrors?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  ingestionComplete?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  originalFile?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  overrideSerial?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  processingEnd?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  processingStart?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  projectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  remaining?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  stoppingInitiated?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  total?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  uploadComplete?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  uploadedFile?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type BatchErrorResolvers<ContextType = any, ParentType extends ResolversParentTypes['BatchError'] = ResolversParentTypes['BatchError']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  batch?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  created?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  error?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type BatchPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['BatchPayload'] = ResolversParentTypes['BatchPayload']> = {
  batch?: Resolver<Maybe<ResolversTypes['Batch']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type BatchesConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['BatchesConnection'] = ResolversParentTypes['BatchesConnection']> = {
  batches?: Resolver<Array<Maybe<ResolversTypes['Batch']>>, ParentType, ContextType>;
  pageInfo?: Resolver<Maybe<ResolversTypes['PageInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CameraConfigResolvers<ContextType = any, ParentType extends ResolversParentTypes['CameraConfig'] = ResolversParentTypes['CameraConfig']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  deployments?: Resolver<Array<ResolversTypes['Deployment']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CategoriesResolvers<ContextType = any, ParentType extends ResolversParentTypes['Categories'] = ResolversParentTypes['Categories']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  color?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreateImagePayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateImagePayload'] = ResolversParentTypes['CreateImagePayload']> = {
  imageAttempt?: Resolver<Maybe<ResolversTypes['ImageAttempt']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreateUploadPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateUploadPayload'] = ResolversParentTypes['CreateUploadPayload']> = {
  batch?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  multipartUploadId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  urls?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  user?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CreateViewPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['CreateViewPayload'] = ResolversParentTypes['CreateViewPayload']> = {
  view?: Resolver<Maybe<ResolversTypes['View']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type DeleteViewPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['DeleteViewPayload'] = ResolversParentTypes['DeleteViewPayload']> = {
  project?: Resolver<Maybe<ResolversTypes['Project']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type DeploymentResolvers<ContextType = any, ParentType extends ResolversParentTypes['Deployment'] = ResolversParentTypes['Deployment']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  editable?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['Location']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startDate?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  timezone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExportErrorResolvers<ContextType = any, ParentType extends ResolversParentTypes['ExportError'] = ResolversParentTypes['ExportError']> = {
  message?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExportPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['ExportPayload'] = ResolversParentTypes['ExportPayload']> = {
  documentId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ExportStatusPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['ExportStatusPayload'] = ResolversParentTypes['ExportStatusPayload']> = {
  count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  error?: Resolver<Maybe<Array<Maybe<ResolversTypes['ExportError']>>>, ParentType, ContextType>;
  meta?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  url?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FiltersResolvers<ContextType = any, ParentType extends ResolversParentTypes['Filters'] = ResolversParentTypes['Filters']> = {
  addedEnd?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  addedStart?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  cameras?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  createdEnd?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  createdStart?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  custom?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  deployments?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  labels?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  notReviewed?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  reviewed?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageResolvers<ContextType = any, ParentType extends ResolversParentTypes['Image'] = ResolversParentTypes['Image']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  batchId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bucket?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  cameraId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  comments?: Resolver<Maybe<Array<Maybe<ResolversTypes['ImageComment']>>>, ParentType, ContextType>;
  dateAdded?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  dateTimeOriginal?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  deploymentId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  errors?: Resolver<Maybe<Array<Maybe<ResolversTypes['ImageError']>>>, ParentType, ContextType>;
  fileTypeExtension?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  imageBytes?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  imageHeight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  imageWidth?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  location?: Resolver<Maybe<ResolversTypes['Location']>, ParentType, ContextType>;
  make?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  mimeType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  model?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  objects?: Resolver<Maybe<Array<Maybe<ResolversTypes['Object']>>>, ParentType, ContextType>;
  originalFileName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  path?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  projectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  reviewed?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  timezone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userSetData?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageAttemptResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImageAttempt'] = ResolversParentTypes['ImageAttempt']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  batch?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  created?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  errors?: Resolver<Maybe<Array<Maybe<ResolversTypes['ImageError']>>>, ParentType, ContextType>;
  metadata?: Resolver<Maybe<ResolversTypes['ImageMetadata']>, ParentType, ContextType>;
  projectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageCommentResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImageComment'] = ResolversParentTypes['ImageComment']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  author?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  comment?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  created?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageCommentsPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImageCommentsPayload'] = ResolversParentTypes['ImageCommentsPayload']> = {
  comments?: Resolver<Maybe<Array<Maybe<ResolversTypes['ImageComment']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageErrorResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImageError'] = ResolversParentTypes['ImageError']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  batch?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  created?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  error?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  image?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  path?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageErrorsConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImageErrorsConnection'] = ResolversParentTypes['ImageErrorsConnection']> = {
  errors?: Resolver<Array<Maybe<ResolversTypes['ImageError']>>, ParentType, ContextType>;
  pageInfo?: Resolver<Maybe<ResolversTypes['PageInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImageMetadataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImageMetadata'] = ResolversParentTypes['ImageMetadata']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  batchId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bucket?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cameraId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dateAdded?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  dateTimeOriginal?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  fileTypeExtension?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  imageBytes?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  imageHeight?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  imageWidth?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  make?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  mimeType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  model?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  originalFileName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  path?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  timezone?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImagesConnectionResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImagesConnection'] = ResolversParentTypes['ImagesConnection']> = {
  images?: Resolver<Array<Maybe<ResolversTypes['Image']>>, ParentType, ContextType>;
  pageInfo?: Resolver<Maybe<ResolversTypes['PageInfo']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ImagesCountResolvers<ContextType = any, ParentType extends ResolversParentTypes['ImagesCount'] = ResolversParentTypes['ImagesCount']> = {
  count?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type LabelResolvers<ContextType = any, ParentType extends ResolversParentTypes['Label'] = ResolversParentTypes['Label']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  bbox?: Resolver<Array<ResolversTypes['Float']>, ParentType, ContextType>;
  conf?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  labelId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  labeledDate?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  mlModel?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  mlModelVersion?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  userId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  validation?: Resolver<Maybe<ResolversTypes['Validation']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LabelListResolvers<ContextType = any, ParentType extends ResolversParentTypes['LabelList'] = ResolversParentTypes['LabelList']> = {
  categories?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LocationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Location'] = ResolversParentTypes['Location']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  altitude?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  geometry?: Resolver<ResolversTypes['Point'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MlModelResolvers<ContextType = any, ParentType extends ResolversParentTypes['MLModel'] = ResolversParentTypes['MLModel']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  categories?: Resolver<Maybe<Array<Maybe<ResolversTypes['Categories']>>>, ParentType, ContextType>;
  defaultConfThreshold?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  version?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  clearBatchErrors?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationClearBatchErrorsArgs, 'input'>>;
  clearImageErrors?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationClearImageErrorsArgs, 'input'>>;
  closeUpload?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationCloseUploadArgs, 'input'>>;
  createBatchError?: Resolver<Maybe<ResolversTypes['BatchError']>, ParentType, ContextType, RequireFields<MutationCreateBatchErrorArgs, 'input'>>;
  createDeployment?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<MutationCreateDeploymentArgs, 'input'>>;
  createImage?: Resolver<Maybe<ResolversTypes['CreateImagePayload']>, ParentType, ContextType, RequireFields<MutationCreateImageArgs, 'input'>>;
  createImageComment?: Resolver<Maybe<ResolversTypes['ImageCommentsPayload']>, ParentType, ContextType, RequireFields<MutationCreateImageCommentArgs, 'input'>>;
  createImageError?: Resolver<Maybe<ResolversTypes['ImageError']>, ParentType, ContextType, RequireFields<MutationCreateImageErrorArgs, 'input'>>;
  createInternalLabels?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationCreateInternalLabelsArgs, 'input'>>;
  createLabels?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationCreateLabelsArgs, 'input'>>;
  createObjects?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationCreateObjectsArgs, 'input'>>;
  createProject?: Resolver<Maybe<ResolversTypes['ProjectPayload']>, ParentType, ContextType, RequireFields<MutationCreateProjectArgs, 'input'>>;
  createProjectLabel?: Resolver<Maybe<ResolversTypes['ProjectLabelPayload']>, ParentType, ContextType, RequireFields<MutationCreateProjectLabelArgs, 'input'>>;
  createUpload?: Resolver<Maybe<ResolversTypes['CreateUploadPayload']>, ParentType, ContextType, RequireFields<MutationCreateUploadArgs, 'input'>>;
  createUser?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationCreateUserArgs, 'input'>>;
  createView?: Resolver<Maybe<ResolversTypes['CreateViewPayload']>, ParentType, ContextType, RequireFields<MutationCreateViewArgs, 'input'>>;
  deleteDeployment?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<MutationDeleteDeploymentArgs, 'input'>>;
  deleteImageComment?: Resolver<Maybe<ResolversTypes['ImageCommentsPayload']>, ParentType, ContextType, RequireFields<MutationDeleteImageCommentArgs, 'input'>>;
  deleteImages?: Resolver<Maybe<ResolversTypes['StandardErrorPayload']>, ParentType, ContextType, RequireFields<MutationDeleteImagesArgs, 'input'>>;
  deleteLabels?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationDeleteLabelsArgs, 'input'>>;
  deleteObjects?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationDeleteObjectsArgs, 'input'>>;
  deleteProjectLabel?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationDeleteProjectLabelArgs, 'input'>>;
  deleteView?: Resolver<Maybe<ResolversTypes['DeleteViewPayload']>, ParentType, ContextType, RequireFields<MutationDeleteViewArgs, 'input'>>;
  redriveBatch?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationRedriveBatchArgs, 'input'>>;
  registerCamera?: Resolver<Maybe<ResolversTypes['RegisterCameraPayload']>, ParentType, ContextType, RequireFields<MutationRegisterCameraArgs, 'input'>>;
  stopBatch?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationStopBatchArgs, 'input'>>;
  unregisterCamera?: Resolver<Maybe<ResolversTypes['UnregisterCameraPayload']>, ParentType, ContextType, RequireFields<MutationUnregisterCameraArgs, 'input'>>;
  updateAutomationRules?: Resolver<Maybe<ResolversTypes['UpdateAutomationRulesPayload']>, ParentType, ContextType, RequireFields<MutationUpdateAutomationRulesArgs, 'input'>>;
  updateBatch?: Resolver<Maybe<ResolversTypes['BatchPayload']>, ParentType, ContextType, RequireFields<MutationUpdateBatchArgs, 'input'>>;
  updateDeployment?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<MutationUpdateDeploymentArgs, 'input'>>;
  updateImageComment?: Resolver<Maybe<ResolversTypes['ImageCommentsPayload']>, ParentType, ContextType, RequireFields<MutationUpdateImageCommentArgs, 'input'>>;
  updateLabels?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationUpdateLabelsArgs, 'input'>>;
  updateObjects?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationUpdateObjectsArgs, 'input'>>;
  updateProject?: Resolver<Maybe<ResolversTypes['ProjectPayload']>, ParentType, ContextType, RequireFields<MutationUpdateProjectArgs, 'input'>>;
  updateProjectLabel?: Resolver<Maybe<ResolversTypes['ProjectLabelPayload']>, ParentType, ContextType, RequireFields<MutationUpdateProjectLabelArgs, 'input'>>;
  updateUser?: Resolver<Maybe<ResolversTypes['StandardPayload']>, ParentType, ContextType, RequireFields<MutationUpdateUserArgs, 'input'>>;
  updateView?: Resolver<Maybe<ResolversTypes['UpdateViewPayload']>, ParentType, ContextType, RequireFields<MutationUpdateViewArgs, 'input'>>;
};

export type ObjectResolvers<ContextType = any, ParentType extends ResolversParentTypes['Object'] = ResolversParentTypes['Object']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  bbox?: Resolver<Maybe<Array<ResolversTypes['Float']>>, ParentType, ContextType>;
  labels?: Resolver<Maybe<Array<Maybe<ResolversTypes['Label']>>>, ParentType, ContextType>;
  locked?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  hasNext?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  hasPrevious?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  next?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  previous?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PointResolvers<ContextType = any, ParentType extends ResolversParentTypes['Point'] = ResolversParentTypes['Point']> = {
  coordinates?: Resolver<Array<ResolversTypes['Float']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProjectResolvers<ContextType = any, ParentType extends ResolversParentTypes['Project'] = ResolversParentTypes['Project']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  automationRules?: Resolver<Maybe<Array<Maybe<ResolversTypes['AutomationRule']>>>, ParentType, ContextType>;
  availableMLModels?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  cameraConfigs?: Resolver<Maybe<Array<Maybe<ResolversTypes['CameraConfig']>>>, ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  labels?: Resolver<Maybe<Array<Maybe<ResolversTypes['ProjectLabel']>>>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timezone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  views?: Resolver<Array<ResolversTypes['View']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProjectLabelResolvers<ContextType = any, ParentType extends ResolversParentTypes['ProjectLabel'] = ResolversParentTypes['ProjectLabel']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  color?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  reviewerEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProjectLabelPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['ProjectLabelPayload'] = ResolversParentTypes['ProjectLabelPayload']> = {
  label?: Resolver<Maybe<ResolversTypes['ProjectLabel']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProjectPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['ProjectPayload'] = ResolversParentTypes['ProjectPayload']> = {
  project?: Resolver<Maybe<ResolversTypes['Project']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProjectRegistrationResolvers<ContextType = any, ParentType extends ResolversParentTypes['ProjectRegistration'] = ResolversParentTypes['ProjectRegistration']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  active?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  projectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  batches?: Resolver<Maybe<ResolversTypes['BatchesConnection']>, ParentType, ContextType, RequireFields<QueryBatchesArgs, 'input'>>;
  exportAnnotations?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QueryExportAnnotationsArgs, 'input'>>;
  exportErrors?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QueryExportErrorsArgs, 'input'>>;
  image?: Resolver<Maybe<ResolversTypes['Image']>, ParentType, ContextType, RequireFields<QueryImageArgs, 'input'>>;
  imageErrors?: Resolver<Maybe<ResolversTypes['ImageErrorsConnection']>, ParentType, ContextType, RequireFields<QueryImageErrorsArgs, 'input'>>;
  images?: Resolver<Maybe<ResolversTypes['ImagesConnection']>, ParentType, ContextType, RequireFields<QueryImagesArgs, 'input'>>;
  imagesCount?: Resolver<Maybe<ResolversTypes['ImagesCount']>, ParentType, ContextType, RequireFields<QueryImagesCountArgs, 'input'>>;
  labels?: Resolver<Maybe<ResolversTypes['LabelList']>, ParentType, ContextType>;
  mlModels?: Resolver<Maybe<Array<Maybe<ResolversTypes['MLModel']>>>, ParentType, ContextType, Partial<QueryMlModelsArgs>>;
  projects?: Resolver<Maybe<Array<Maybe<ResolversTypes['Project']>>>, ParentType, ContextType, Partial<QueryProjectsArgs>>;
  stats?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QueryStatsArgs, 'input'>>;
  task?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QueryTaskArgs, 'input'>>;
  tasks?: Resolver<Maybe<ResolversTypes['TasksPayload']>, ParentType, ContextType, Partial<QueryTasksArgs>>;
  users?: Resolver<Maybe<ResolversTypes['UsersPayload']>, ParentType, ContextType, Partial<QueryUsersArgs>>;
  wirelessCameras?: Resolver<Maybe<Array<Maybe<ResolversTypes['WirelessCamera']>>>, ParentType, ContextType, Partial<QueryWirelessCamerasArgs>>;
};

export type RegisterCameraPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['RegisterCameraPayload'] = ResolversParentTypes['RegisterCameraPayload']> = {
  project?: Resolver<Maybe<ResolversTypes['Project']>, ParentType, ContextType>;
  wirelessCameras?: Resolver<Maybe<Array<Maybe<ResolversTypes['WirelessCamera']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type StandardErrorPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StandardErrorPayload'] = ResolversParentTypes['StandardErrorPayload']> = {
  errors?: Resolver<Maybe<Array<Maybe<ResolversTypes['String']>>>, ParentType, ContextType>;
  isOk?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type StandardPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['StandardPayload'] = ResolversParentTypes['StandardPayload']> = {
  isOk?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TaskResolvers<ContextType = any, ParentType extends ResolversParentTypes['Task'] = ResolversParentTypes['Task']> = {
  _id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  created?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  output?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  projectId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updated?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TasksPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['TasksPayload'] = ResolversParentTypes['TasksPayload']> = {
  tasks?: Resolver<Array<Maybe<ResolversTypes['Task']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UnregisterCameraPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['UnregisterCameraPayload'] = ResolversParentTypes['UnregisterCameraPayload']> = {
  project?: Resolver<Maybe<ResolversTypes['Project']>, ParentType, ContextType>;
  wirelessCameras?: Resolver<Maybe<Array<Maybe<ResolversTypes['WirelessCamera']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UpdateAutomationRulesPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['UpdateAutomationRulesPayload'] = ResolversParentTypes['UpdateAutomationRulesPayload']> = {
  automationRules?: Resolver<Maybe<Array<Maybe<ResolversTypes['AutomationRule']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UpdateViewPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['UpdateViewPayload'] = ResolversParentTypes['UpdateViewPayload']> = {
  view?: Resolver<Maybe<ResolversTypes['View']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  created?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  enabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  roles?: Resolver<Array<Maybe<ResolversTypes['UserRole']>>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updated?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UsersPayloadResolvers<ContextType = any, ParentType extends ResolversParentTypes['UsersPayload'] = ResolversParentTypes['UsersPayload']> = {
  users?: Resolver<Array<Maybe<ResolversTypes['User']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ValidationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Validation'] = ResolversParentTypes['Validation']> = {
  userId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  validated?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  validationDate?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ViewResolvers<ContextType = any, ParentType extends ResolversParentTypes['View'] = ResolversParentTypes['View']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  editable?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  filters?: Resolver<ResolversTypes['Filters'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type WirelessCameraResolvers<ContextType = any, ParentType extends ResolversParentTypes['WirelessCamera'] = ResolversParentTypes['WirelessCamera']> = {
  _id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  make?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  model?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  projRegistrations?: Resolver<Array<ResolversTypes['ProjectRegistration']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  AutomationAction?: AutomationActionResolvers<ContextType>;
  AutomationEvent?: AutomationEventResolvers<ContextType>;
  AutomationRule?: AutomationRuleResolvers<ContextType>;
  Batch?: BatchResolvers<ContextType>;
  BatchError?: BatchErrorResolvers<ContextType>;
  BatchPayload?: BatchPayloadResolvers<ContextType>;
  BatchesConnection?: BatchesConnectionResolvers<ContextType>;
  CameraConfig?: CameraConfigResolvers<ContextType>;
  Categories?: CategoriesResolvers<ContextType>;
  CreateImagePayload?: CreateImagePayloadResolvers<ContextType>;
  CreateUploadPayload?: CreateUploadPayloadResolvers<ContextType>;
  CreateViewPayload?: CreateViewPayloadResolvers<ContextType>;
  Date?: GraphQLScalarType;
  DeleteViewPayload?: DeleteViewPayloadResolvers<ContextType>;
  Deployment?: DeploymentResolvers<ContextType>;
  ExportError?: ExportErrorResolvers<ContextType>;
  ExportPayload?: ExportPayloadResolvers<ContextType>;
  ExportStatusPayload?: ExportStatusPayloadResolvers<ContextType>;
  Filters?: FiltersResolvers<ContextType>;
  Image?: ImageResolvers<ContextType>;
  ImageAttempt?: ImageAttemptResolvers<ContextType>;
  ImageComment?: ImageCommentResolvers<ContextType>;
  ImageCommentsPayload?: ImageCommentsPayloadResolvers<ContextType>;
  ImageError?: ImageErrorResolvers<ContextType>;
  ImageErrorsConnection?: ImageErrorsConnectionResolvers<ContextType>;
  ImageMetadata?: ImageMetadataResolvers<ContextType>;
  ImagesConnection?: ImagesConnectionResolvers<ContextType>;
  ImagesCount?: ImagesCountResolvers<ContextType>;
  JSONObject?: GraphQLScalarType;
  Label?: LabelResolvers<ContextType>;
  LabelList?: LabelListResolvers<ContextType>;
  Location?: LocationResolvers<ContextType>;
  MLModel?: MlModelResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Object?: ObjectResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Point?: PointResolvers<ContextType>;
  Project?: ProjectResolvers<ContextType>;
  ProjectLabel?: ProjectLabelResolvers<ContextType>;
  ProjectLabelPayload?: ProjectLabelPayloadResolvers<ContextType>;
  ProjectPayload?: ProjectPayloadResolvers<ContextType>;
  ProjectRegistration?: ProjectRegistrationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RegisterCameraPayload?: RegisterCameraPayloadResolvers<ContextType>;
  StandardErrorPayload?: StandardErrorPayloadResolvers<ContextType>;
  StandardPayload?: StandardPayloadResolvers<ContextType>;
  Task?: TaskResolvers<ContextType>;
  TasksPayload?: TasksPayloadResolvers<ContextType>;
  UnregisterCameraPayload?: UnregisterCameraPayloadResolvers<ContextType>;
  UpdateAutomationRulesPayload?: UpdateAutomationRulesPayloadResolvers<ContextType>;
  UpdateViewPayload?: UpdateViewPayloadResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  UsersPayload?: UsersPayloadResolvers<ContextType>;
  Validation?: ValidationResolvers<ContextType>;
  View?: ViewResolvers<ContextType>;
  WirelessCamera?: WirelessCameraResolvers<ContextType>;
};

