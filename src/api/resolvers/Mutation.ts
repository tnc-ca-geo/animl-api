import type * as gql from '../../@types/graphql.js';
import { Context } from '../handler.js';

export default {
  createBatchError: async (
    _: unknown,
    { input }: gql.MutationCreateBatchErrorArgs,
    context: Context,
  ) => {
    const error = await context.models.BatchError.createError(input);
    return { ...error };
  },

  createImageError: async (
    _: unknown,
    { input }: gql.MutationCreateImageErrorArgs,
    context: Context,
  ) => {
    const error = await context.models.ImageError.createError(input);
    return { ...error };
  },

  clearImageErrors: async (
    _: unknown,
    { input }: gql.MutationClearImageErrorsArgs,
    context: Context,
  ) => {
    const res = await context.models.ImageError.clearErrors(input);
    return { ...res };
  },

  clearBatchErrors: async (
    _: unknown,
    { input }: gql.MutationClearBatchErrorsArgs,
    context: Context,
  ) => {
    const res = await context.models.BatchError.clearErrors(input);
    return { ...res };
  },

  createUpload: async (_: unknown, { input }: gql.MutationCreateUploadArgs, context: Context) => {
    const res = await context.models.Batch.createUpload(input, context);
    return { ...res };
  },

  closeUpload: async (_: unknown, { input }: gql.MutationCloseUploadArgs, context: Context) => {
    const res = await context.models.Batch.closeUpload(input);
    return { ...res };
  },

  createUser: async (_: unknown, { input }: gql.MutationCreateUserArgs, context: Context) => {
    const res = await context.models.User.createUser(input, context);
    return { ...res };
  },

  updateUser: async (_: unknown, { input }: gql.MutationUpdateUserArgs, context: Context) => {
    const res = await context.models.User.updateUser(input, context);
    return { ...res };
  },

  updateBatch: async (_: unknown, { input }: gql.MutationUpdateBatchArgs, context: Context) => {
    const batch = await context.models.Batch.updateBatch(input);
    return { batch };
  },

  redriveBatch: async (_: unknown, { input }: gql.MutationRedriveBatchArgs, context: Context) => {
    const res = await context.models.Batch.redriveBatch(input);
    return { ...res };
  },

  stopBatch: async (_: unknown, { input }: gql.MutationStopBatchArgs, context: Context) => {
    const res = await context.models.Batch.stopBatch(input);
    return { ...res };
  },

  deleteImageComment: async (
    _: unknown,
    { input }: gql.MutationDeleteImageCommentArgs,
    context: Context,
  ) => {
    const res = await context.models.Image.deleteComment(input, context);
    return { ...res };
  },

  updateImageComment: async (
    _: unknown,
    { input }: gql.MutationUpdateImageCommentArgs,
    context: Context,
  ) => {
    const res = await context.models.Image.updateComment(input, context);
    return { ...res };
  },

  createImageComment: async (
    _: unknown,
    { input }: gql.MutationCreateImageCommentArgs,
    context: Context,
  ) => {
    const res = await context.models.Image.createComment(input, context);
    return { ...res };
  },

  createImage: async (_: unknown, { input }: gql.MutationCreateImageArgs, context: Context) => {
    const imageAttempt = await context.models.Image.createImage(input, context);
    return { imageAttempt };
  },

  deleteImages: async (_: unknown, { input }: gql.MutationDeleteImagesArgs, context: Context) => {
    const res = await context.models.Image.deleteImages(input, context);
    return { ...res };
  },

  registerCamera: async (
    _: unknown,
    { input }: gql.MutationRegisterCameraArgs,
    context: Context,
  ) => {
    const res = await context.models.Camera.registerCamera(input, context);
    return { ...res };
  },

  unregisterCamera: async (
    _: unknown,
    { input }: gql.MutationUnregisterCameraArgs,
    context: Context,
  ) => {
    const res = await context.models.Camera.unregisterCamera(input, context);
    return { ...res };
  },

  createProject: async (_: unknown, { input }: gql.MutationCreateProjectArgs, context: Context) => {
    const project = await context.models.Project.createProject(input, context);
    return { project };
  },

  updateProject: async (_: unknown, { input }: gql.MutationUpdateProjectArgs, context: Context) => {
    const project = await context.models.Project.updateProject(input, context);
    return { project };
  },

  createProjectLabel: async (
    _: unknown,
    { input }: gql.MutationCreateProjectLabelArgs,
    context: Context,
  ) => {
    const label = await context.models.Project.createLabel(input, context);
    return { label };
  },

  updateProjectLabel: async (
    _: unknown,
    { input }: gql.MutationUpdateProjectLabelArgs,
    context: Context,
  ) => {
    const label = await context.models.Project.updateLabel(input, context);
    return { label };
  },

  deleteProjectLabel: async (
    _: unknown,
    { input }: gql.MutationDeleteProjectLabelArgs,
    context: Context,
  ) => {
    const res = await context.models.Project.deleteLabel(input, context);
    return { ...res };
  },

  createView: async (_: unknown, { input }: gql.MutationCreateViewArgs, context: Context) => {
    const view = await context.models.Project.createView(input, context);
    return { view };
  },

  updateView: async (_: unknown, { input }: gql.MutationUpdateViewArgs, context: Context) => {
    const view = await context.models.Project.updateView(input, context);
    return { view };
  },

  deleteView: async (_: unknown, { input }: gql.MutationDeleteViewArgs, context: Context) => {
    const project = await context.models.Project.deleteView(input, context);
    return { project };
  },

  updateAutomationRules: async (
    _: unknown,
    { input }: gql.MutationUpdateAutomationRulesArgs,
    context: Context,
  ) => {
    const automationRules = await context.models.Project.updateAutomationRules(input, context);
    return { automationRules };
  },

  createDeployment: async (
    _: unknown,
    { input }: gql.MutationCreateDeploymentArgs,
    context: Context,
  ) => {
    return await context.models.Project.createDeployment(input, context);
  },

  updateDeployment: async (
    _: unknown,
    { input }: gql.MutationUpdateDeploymentArgs,
    context: Context,
  ) => {
    return await context.models.Project.updateDeployment(input, context);
  },

  deleteDeployment: async (
    _: unknown,
    { input }: gql.MutationDeleteDeploymentArgs,
    context: Context,
  ) => {
    return await context.models.Project.deleteDeployment(input, context);
  },

  createObjects: async (_: unknown, { input }: gql.MutationCreateObjectsArgs, context: Context) => {
    const res = await context.models.Image.createObjects(input, context);
    return { isOk: res.ok };
  },

  updateObjects: async (_: unknown, { input }: gql.MutationUpdateObjectsArgs, context: Context) => {
    const res = await context.models.Image.updateObjects(input, context);
    return { isOk: res.ok };
  },

  deleteObjects: async (_: unknown, { input }: gql.MutationDeleteObjectsArgs, context: Context) => {
    const res = await context.models.Image.deleteObjects(input, context);
    return { isOk: res.ok };
  },

  createInternalLabels: async (
    _: unknown,
    { input }: gql.MutationCreateInternalLabelsArgs,
    context: Context,
  ) => {
    const res = await context.models.Image.createInternalLabels(input, context);
    return { isOk: res.ok };
  },

  createLabels: async (_: unknown, { input }: gql.MutationCreateLabelsArgs, context: Context) => {
    const res = await context.models.Image.createLabels(input, context);
    return { isOk: res.ok };
  },

  updateLabels: async (_: unknown, { input }: gql.MutationUpdateLabelsArgs, context: Context) => {
    const res = await context.models.Image.updateLabels(input, context);
    return { isOk: res.ok };
  },

  deleteLabels: async (_: unknown, { input }: gql.MutationDeleteLabelsArgs, context: Context) => {
    const res = await context.models.Image.deleteLabels(input, context);
    return { isOk: res.ok };
  },
};
