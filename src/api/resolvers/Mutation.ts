import { Context } from '../db/models/utils.js';
import { QLInput } from './utils.js';

import * as graphql from '../../generated/graphql.js';

const Mutation = {
  createBatchError: async (
    _: unknown,
    { input }: QLInput<graphql.CreateBatchErrorInput>,
    context: Context,
  ) => {
    const error = await context.models.BatchError.createError(input);
    return { ...error };
  },

  createImageError: async (
    _: unknown,
    { input }: QLInput<graphql.CreateImageErrorInput>,
    context: Context,
  ) => {
    const error = await context.models.ImageError.createError(input);
    return { ...error };
  },

  clearImageErrors: async (
    _: unknown,
    { input }: QLInput<graphql.ClearImageErrorsInput>,
    context: Context,
  ) => {
    const res = await context.models.ImageError.clearErrors(input);
    return { ...res };
  },

  clearBatchErrors: async (
    _: unknown,
    { input }: QLInput<graphql.ClearBatchErrorsInput>,
    context: Context,
  ) => {
    const res = await context.models.BatchError.clearErrors(input);
    return { ...res };
  },

  createUpload: async (
    _: unknown,
    { input }: QLInput<graphql.CreateUploadInput>,
    context: Context,
  ) => {
    const res = await context.models.Batch.createUpload(input, context);
    return { ...res };
  },

  closeUpload: async (
    _: unknown,
    { input }: QLInput<graphql.CloseUploadInput>,
    context: Context,
  ) => {
    const res = await context.models.Batch.closeUpload(input);
    return { ...res };
  },

  createUser: async (_: unknown, { input }: QLInput<graphql.CreateUserInput>, context: Context) => {
    const res = await context.models.User.createUser(input, context);
    return { ...res };
  },

  updateUser: async (_: unknown, { input }: QLInput<graphql.UpdateUserInput>, context: Context) => {
    const res = await context.models.User.updateUser(input, context);
    return { ...res };
  },

  updateBatch: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateBatchInput>,
    context: Context,
  ) => {
    const batch = await context.models.Batch.updateBatch(input);
    return { batch };
  },

  redriveBatch: async (
    _: unknown,
    { input }: QLInput<graphql.RedriveBatchInput>,
    context: Context,
  ) => {
    const res = await context.models.Batch.redriveBatch(input);
    return { ...res };
  },

  stopBatch: async (_: unknown, { input }: QLInput<graphql.StopBatchInput>, context: Context) => {
    const res = await context.models.Batch.stopBatch(input);
    return { ...res };
  },

  deleteImageComment: async (
    _: unknown,
    { input }: QLInput<graphql.DeleteImageCommentInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.deleteComment(input, context);
    return { ...res };
  },

  updateImageComment: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateImageCommentInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.updateComment(input, context);
    return { ...res };
  },

  createImageComment: async (
    _: unknown,
    { input }: QLInput<graphql.CreateImageCommentInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.createComment(input, context);
    return { ...res };
  },

  createImage: async (
    _: unknown,
    { input }: QLInput<graphql.CreateImageInput>,
    context: Context,
  ) => {
    const imageAttempt = await context.models.Image.createImage(input, context);
    return { imageAttempt };
  },

  deleteImages: async (
    _: unknown,
    { input }: QLInput<graphql.DeleteImagesInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.deleteImages(input, context);
    return { ...res };
  },

  registerCamera: async (
    _: unknown,
    { input }: QLInput<graphql.RegisterCameraInput>,
    context: Context,
  ) => {
    const res = await context.models.Camera.registerCamera(input, context);
    return { ...res };
  },

  unregisterCamera: async (
    _: unknown,
    { input }: QLInput<graphql.UnregisterCameraInput>,
    context: Context,
  ) => {
    const res = await context.models.Camera.unregisterCamera(input, context);
    return { ...res };
  },

  createProject: async (
    _: unknown,
    { input }: QLInput<graphql.CreateProjectInput>,
    context: Context,
  ) => {
    const project = await context.models.Project.createProject(input, context);
    return { project };
  },

  updateProject: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateProjectInput>,
    context: Context,
  ) => {
    const project = await context.models.Project.updateProject(input, context);
    return { project };
  },

  createProjectLabel: async (
    _: unknown,
    { input }: QLInput<graphql.CreateProjectLabelInput>,
    context: Context,
  ) => {
    const label = await context.models.Project.createLabel(input, context);
    return { label };
  },

  updateProjectLabel: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateProjectLabelInput>,
    context: Context,
  ) => {
    const label = await context.models.Project.updateLabel(input, context);
    return { label };
  },

  deleteProjectLabel: async (
    _: unknown,
    { input }: QLInput<graphql.DeleteProjectLabelInput>,
    context: Context,
  ) => {
    const res = await context.models.Project.deleteLabel(input, context);
    return { ...res };
  },

  createView: async (_: unknown, { input }: QLInput<graphql.CreateViewInput>, context: Context) => {
    const view = await context.models.Project.createView(input, context);
    return { view };
  },

  updateView: async (_: unknown, { input }: QLInput<graphql.UpdateViewInput>, context: Context) => {
    const view = await context.models.Project.updateView(input, context);
    return { view };
  },

  deleteView: async (_: unknown, { input }: QLInput<graphql.DeleteViewInput>, context: Context) => {
    const project = await context.models.Project.deleteView(input, context);
    return { project };
  },

  updateAutomationRules: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateAutomationRulesInput>,
    context: Context,
  ) => {
    const automationRules = await context.models.Project.updateAutomationRules(input, context);
    return { automationRules };
  },

  createDeployment: async (
    _: unknown,
    { input }: QLInput<graphql.CreateDeploymentInput>,
    context: Context,
  ) => {
    return await context.models.Project.createDeployment(input, context);
  },

  updateDeployment: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateDeploymentInput>,
    context: Context,
  ) => {
    return await context.models.Project.updateDeployment(input, context);
  },

  deleteDeployment: async (
    _: unknown,
    { input }: QLInput<graphql.DeleteDeploymentInput>,
    context: Context,
  ) => {
    return await context.models.Project.deleteDeployment(input, context);
  },

  createObjects: async (
    _: unknown,
    { input }: QLInput<graphql.CreateObjectsInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.createObjects(input, context);
    return { isOk: res.ok };
  },

  updateObjects: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateObjectsInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.updateObjects(input);
    return { isOk: res.ok };
  },

  deleteObjects: async (
    _: unknown,
    { input }: QLInput<graphql.DeleteObjectsInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.deleteObjects(input);
    return { isOk: res.ok };
  },

  createInternalLabels: async (
    _: unknown,
    { input }: QLInput<graphql.CreateInternalLabelsInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.createInternalLabels(input, context);
    return { isOk: res.ok };
  },

  createLabels: async (
    _: unknown,
    { input }: QLInput<graphql.CreateLabelsInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.createLabels(input, context);
    return { isOk: res.ok };
  },

  updateLabels: async (
    _: unknown,
    { input }: QLInput<graphql.UpdateLabelsInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.updateLabels(input);
    return { isOk: res.ok };
  },

  deleteLabels: async (
    _: unknown,
    { input }: QLInput<graphql.DeleteLabelsInput>,
    context: Context,
  ) => {
    const res = await context.models.Image.deleteLabels(input);
    return { isOk: res.ok };
  },
};

export default Mutation;
