export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
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
  alertRecipients?: Maybe<Array<Scalars['String']['output']>>;
  categoryConfig?: Maybe<Scalars['JSONObject']['output']>;
  confThreshold?: Maybe<Scalars['Float']['output']>;
  mlModel?: Maybe<Scalars['String']['output']>;
  type: Scalars['String']['output'];
};

export type AutomationActionInput = {
  alertRecipients?: InputMaybe<Array<Scalars['String']['input']>>;
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
  errors?: Maybe<Array<BatchError>>;
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
  batches: Array<Batch>;
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
  parts: Array<CloseUploadPart>;
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
  labels: Array<CreateInternalLabelInput>;
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
  labels: Array<CreateLabelInput>;
};

export type CreateObjectInput = {
  imageId: Scalars['ID']['input'];
  object: ObjectInput;
};

export type CreateObjectsInput = {
  objects: Array<CreateObjectInput>;
};

export type CreateProjectInput = {
  availableMLModels: Array<Scalars['String']['input']>;
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
  urls?: Maybe<Array<Scalars['String']['output']>>;
  user: Scalars['String']['output'];
};

export type CreateUserInput = {
  roles: Array<UserRole>;
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
  labels: Array<DeleteLabelInput>;
};

export type DeleteObjectInput = {
  imageId: Scalars['ID']['input'];
  objectId: Scalars['ID']['input'];
};

export type DeleteObjectsInput = {
  objects: Array<DeleteObjectInput>;
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

export type ExportErrorsInput = {
  filters: ImageErrorsFilterInput;
};

export type ExportInput = {
  filters: FiltersInput;
  format: Format;
};

export type ExportPayload = {
  __typename?: 'ExportPayload';
  documentId: Scalars['ID']['output'];
};

export type ExportStatusInput = {
  documentId: Scalars['ID']['input'];
};

export type ExportStatusPayload = {
  __typename?: 'ExportStatusPayload';
  count?: Maybe<Scalars['Int']['output']>;
  error?: Maybe<Array<ExportError>>;
  meta?: Maybe<Scalars['JSONObject']['output']>;
  status: Scalars['String']['output'];
  url?: Maybe<Scalars['String']['output']>;
};

export type Filters = {
  __typename?: 'Filters';
  addedEnd?: Maybe<Scalars['Date']['output']>;
  addedStart?: Maybe<Scalars['Date']['output']>;
  cameras?: Maybe<Array<Scalars['String']['output']>>;
  createdEnd?: Maybe<Scalars['Date']['output']>;
  createdStart?: Maybe<Scalars['Date']['output']>;
  custom?: Maybe<Scalars['String']['output']>;
  deployments?: Maybe<Array<Scalars['String']['output']>>;
  labels?: Maybe<Array<Scalars['String']['output']>>;
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
  labels?: InputMaybe<Array<Scalars['String']['input']>>;
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
  comments?: Maybe<Array<ImageComment>>;
  dateAdded: Scalars['Date']['output'];
  dateTimeOriginal: Scalars['Date']['output'];
  deploymentId: Scalars['ID']['output'];
  errors?: Maybe<Array<ImageError>>;
  fileTypeExtension: Scalars['String']['output'];
  imageBytes?: Maybe<Scalars['Int']['output']>;
  imageHeight?: Maybe<Scalars['Int']['output']>;
  imageWidth?: Maybe<Scalars['Int']['output']>;
  location?: Maybe<Location>;
  make: Scalars['String']['output'];
  mimeType?: Maybe<Scalars['String']['output']>;
  model?: Maybe<Scalars['String']['output']>;
  objects?: Maybe<Array<Object>>;
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
  errors?: Maybe<Array<ImageError>>;
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
  comments?: Maybe<Array<ImageComment>>;
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
  errors: Array<ImageError>;
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
  images: Array<Image>;
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
  categories?: Maybe<Array<Scalars['String']['output']>>;
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
  categories?: Maybe<Array<Categories>>;
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
  labels?: Maybe<Array<Label>>;
  locked: Scalars['Boolean']['output'];
};

export type ObjectDiffsInput = {
  bbox?: InputMaybe<Array<Scalars['Float']['input']>>;
  locked?: InputMaybe<Scalars['Boolean']['input']>;
};

export type ObjectInput = {
  _id: Scalars['ID']['input'];
  bbox?: InputMaybe<Array<Scalars['Float']['input']>>;
  labels?: InputMaybe<Array<CreateLabelInput>>;
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
  automationRules?: Maybe<Array<AutomationRule>>;
  availableMLModels?: Maybe<Array<Scalars['String']['output']>>;
  cameraConfigs?: Maybe<Array<CameraConfig>>;
  description?: Maybe<Scalars['String']['output']>;
  labels?: Maybe<Array<ProjectLabel>>;
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
  mlModels?: Maybe<Array<MlModel>>;
  projects?: Maybe<Array<Project>>;
  stats?: Maybe<Task>;
  task?: Maybe<Task>;
  tasks?: Maybe<TasksPayload>;
  users?: Maybe<UsersPayload>;
  wirelessCameras?: Maybe<Array<WirelessCamera>>;
};


export type QueryBatchesArgs = {
  input: QueryBatchesInput;
};


export type QueryExportAnnotationsArgs = {
  input: ExportInput;
};


export type QueryExportErrorsArgs = {
  input: ExportErrorsInput;
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
  wirelessCameras?: Maybe<Array<WirelessCamera>>;
};

export type StandardErrorPayload = {
  __typename?: 'StandardErrorPayload';
  errors?: Maybe<Array<Scalars['String']['output']>>;
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
  tasks: Array<Task>;
};

export type UnregisterCameraInput = {
  cameraId: Scalars['ID']['input'];
};

export type UnregisterCameraPayload = {
  __typename?: 'UnregisterCameraPayload';
  project?: Maybe<Project>;
  wirelessCameras?: Maybe<Array<WirelessCamera>>;
};

export type UpdateAutomationRulesInput = {
  automationRules?: InputMaybe<Array<AutomationRuleInput>>;
};

export type UpdateAutomationRulesPayload = {
  __typename?: 'UpdateAutomationRulesPayload';
  automationRules?: Maybe<Array<AutomationRule>>;
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
  updates: Array<LabelUpdate>;
};

export type UpdateObjectsInput = {
  updates: Array<ObjectUpdate>;
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
  roles: Array<UserRole>;
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
  roles: Array<UserRole>;
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
  users: Array<User>;
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
