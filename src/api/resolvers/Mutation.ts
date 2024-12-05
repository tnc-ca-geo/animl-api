import type * as gql from '../../@types/graphql.js';
import { Context } from '../handler.js';

export default {
  createBatchError: async (
    _: unknown,
    { input }: gql.MutationCreateBatchErrorArgs,
    context: Context,
  ): Promise<gql.BatchError> => {
    return context.models.BatchError.createError(input);
  },

  createImageError: async (
    _: unknown,
    { input }: gql.MutationCreateImageErrorArgs,
    context: Context,
  ): Promise<gql.ImageError> => {
    return context.models.ImageError.createError(input);
  },

  clearImageErrors: async (
    _: unknown,
    { input }: gql.MutationClearImageErrorsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.ImageError.clearErrors(input);
  },

  clearBatchErrors: async (
    _: unknown,
    { input }: gql.MutationClearBatchErrorsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.BatchError.clearErrors(input);
  },

  createUpload: async (
    _: unknown,
    { input }: gql.MutationCreateUploadArgs,
    context: Context,
  ): Promise<gql.CreateUploadPayload> => {
    return context.models.Batch.createUpload(input, context);
  },

  closeUpload: async (
    _: unknown,
    { input }: gql.MutationCloseUploadArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.Batch.closeUpload(input);
  },

  createUser: async (
    _: unknown,
    { input }: gql.MutationCreateUserArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.User.createUser(input, context);
  },

  updateUser: async (
    _: unknown,
    { input }: gql.MutationUpdateUserArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.User.updateUser(input, context);
  },

  updateBatch: async (
    _: unknown,
    { input }: gql.MutationUpdateBatchArgs,
    context: Context,
  ): Promise<gql.BatchPayload> => {
    const batch = await context.models.Batch.updateBatch(input);
    return { batch };
  },

  redriveBatch: async (
    _: unknown,
    { input }: gql.MutationRedriveBatchArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.Batch.redriveBatch(input);
  },

  stopBatch: async (
    _: unknown,
    { input }: gql.MutationStopBatchArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.Batch.stopBatch(input);
  },

  deleteImageComment: async (
    _: unknown,
    { input }: gql.MutationDeleteImageCommentArgs,
    context: Context,
  ): Promise<gql.ImageCommentsPayload> => {
    return context.models.Image.deleteComment(input, context);
  },

  updateImageComment: async (
    _: unknown,
    { input }: gql.MutationUpdateImageCommentArgs,
    context: Context,
  ): Promise<gql.ImageCommentsPayload> => {
    return context.models.Image.updateComment(input, context);
  },

  createImageComment: async (
    _: unknown,
    { input }: gql.MutationCreateImageCommentArgs,
    context: Context,
  ): Promise<gql.ImageCommentsPayload> => {
    return context.models.Image.createComment(input, context);
  },

  createImageTag: async (
    _: unknown,
    { input }: gql.MutationCreateImageTagArgs,
    context: Context,
  ): Promise<gql.ImageTagsPayload> => {
    return context.models.Image.createTag(input, context);
  },

  deleteImageTag: async (
    _: unknown,
    { input }: gql.MutationDeleteImageTagArgs,
    context: Context,
  ): Promise<gql.ImageTagsPayload> => {
    return context.models.Image.deleteTag(input, context);
  },

  createImage: async (
    _: unknown,
    { input }: gql.MutationCreateImageArgs,
    context: Context,
  ): Promise<gql.CreateImagePayload> => {
    const imageAttempt = await context.models.Image.createImage(input, context);
    return { imageAttempt };
  },

  deleteImages: async (
    _: unknown,
    { input }: gql.MutationDeleteImagesArgs,
    context: Context,
  ): Promise<gql.StandardErrorPayload> => {
    return context.models.Image.deleteImages(input, context);
  },

  deleteImagesTask: async (
    _: unknown,
    { input }: gql.MutationDeleteImagesArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.Image.deleteImagesTask(input, context);
  },

  deleteImagesByFilterTask: async (
    _: unknown,
    { input }: gql.MutationDeleteImagesByFilterTaskArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.Image.deleteImagesByFilterTask(input, context);
  },

  registerCamera: async (
    _: unknown,
    { input }: gql.MutationRegisterCameraArgs,
    context: Context,
  ): Promise<gql.RegisterCameraPayload> => {
    return context.models.Camera.registerCamera(input, context);
  },

  unregisterCamera: async (
    _: unknown,
    { input }: gql.MutationUnregisterCameraArgs,
    context: Context,
  ): Promise<gql.UnregisterCameraPayload> => {
    return context.models.Camera.unregisterCamera(input, context);
  },

  updateCameraSerialNumber: async (
    _: unknown,
    { input }: gql.MutationUpdateCameraSerialNumberArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.Camera.updateSerialNumber(input, context);
  },

  deleteCameraConfig: async (
    _: unknown,
    { input }: gql.MutationDeleteCameraArgs,
    context: Context,
  ): Promise<gql.Task> => {
    console.log('Mutation.deleteCamera input:', input);
    return context.models.Camera.deleteCameraConfig(input, context);
  },

  createProject: async (
    _: unknown,
    { input }: gql.MutationCreateProjectArgs,
    context: Context,
  ): Promise<gql.ProjectPayload> => {
    const project = await context.models.Project.createProject(input, context);
    return { project };
  },

  updateProject: async (
    _: unknown,
    { input }: gql.MutationUpdateProjectArgs,
    context: Context,
  ): Promise<gql.ProjectPayload> => {
    const project = await context.models.Project.updateProject(input, context);
    return { project };
  },

  createProjectTag: async (
    _: unknown,
    { input }: gql.MutationCreateProjectTagArgs,
    context: Context,
  ): Promise<gql.ProjectTagsPayload> => {
    return await context.models.Project.createTag(input, context);
  },

  deleteProjectTag: async (
    _: unknown,
    { input }: gql.MutationDeleteProjectTagArgs,
    context: Context,
  ): Promise<gql.ProjectTagsPayload> => {
    return await context.models.Project.deleteTag(input, context);
  },

  updateProjectTag: async (
    _: unknown,
    { input }: gql.MutationUpdateProjectTagArgs,
    context: Context,
  ): Promise<gql.ProjectTagsPayload> => {
    return await context.models.Project.updateTag(input, context);
  },

  createProjectLabel: async (
    _: unknown,
    { input }: gql.MutationCreateProjectLabelArgs,
    context: Context,
  ): Promise<gql.ProjectLabelPayload> => {
    const label = await context.models.Project.createLabel(input, context);
    return { label };
  },

  updateProjectLabel: async (
    _: unknown,
    { input }: gql.MutationUpdateProjectLabelArgs,
    context: Context,
  ): Promise<gql.ProjectLabelPayload> => {
    const label = await context.models.Project.updateLabel(input, context);
    return { label };
  },

  deleteProjectLabel: async (
    _: unknown,
    { input }: gql.MutationDeleteProjectLabelArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return context.models.Project.deleteLabel(input, context);
  },

  createView: async (
    _: unknown,
    { input }: gql.MutationCreateViewArgs,
    context: Context,
  ): Promise<gql.CreateViewPayload> => {
    const view = await context.models.Project.createView(input, context);
    return { view };
  },

  updateView: async (
    _: unknown,
    { input }: gql.MutationUpdateViewArgs,
    context: Context,
  ): Promise<gql.UpdateViewPayload> => {
    const view = await context.models.Project.updateView(input, context);
    return { view };
  },

  deleteView: async (
    _: unknown,
    { input }: gql.MutationDeleteViewArgs,
    context: Context,
  ): Promise<gql.DeleteViewPayload> => {
    const project = await context.models.Project.deleteView(input, context);
    return { project };
  },

  updateAutomationRules: async (
    _: unknown,
    { input }: gql.MutationUpdateAutomationRulesArgs,
    context: Context,
  ): Promise<gql.UpdateAutomationRulesPayload> => {
    const automationRules = await context.models.Project.updateAutomationRules(input, context);
    return { automationRules };
  },

  createDeployment: async (
    _: unknown,
    { input }: gql.MutationCreateDeploymentArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.Project.createDeployment(input, context);
  },

  updateDeployment: async (
    _: unknown,
    { input }: gql.MutationUpdateDeploymentArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.Project.updateDeployment(input, context);
  },

  deleteDeployment: async (
    _: unknown,
    { input }: gql.MutationDeleteDeploymentArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.Project.deleteDeployment(input, context);
  },

  createObjects: async (
    _: unknown,
    { input }: gql.MutationCreateObjectsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    const res = await context.models.Image.createObjects(input, context);
    return { isOk: res.ok };
  },

  updateObjects: async (
    _: unknown,
    { input }: gql.MutationUpdateObjectsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    const res = await context.models.Image.updateObjects(input);
    return { isOk: res.ok };
  },

  deleteObjects: async (
    _: unknown,
    { input }: gql.MutationDeleteObjectsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    const res = await context.models.Image.deleteObjects(input);
    return { isOk: res.ok };
  },

  createInternalLabels: async (
    _: unknown,
    { input }: gql.MutationCreateInternalLabelsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return await context.models.Image.createInternalLabels(input, context);
  },

  createLabels: async (
    _: unknown,
    { input }: gql.MutationCreateLabelsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    return await context.models.Image.createLabels(input, context);
  },

  updateLabels: async (
    _: unknown,
    { input }: gql.MutationUpdateLabelsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    const res = await context.models.Image.updateLabels(input);
    return { isOk: res.ok };
  },

  deleteLabels: async (
    _: unknown,
    { input }: gql.MutationDeleteLabelsArgs,
    context: Context,
  ): Promise<gql.StandardPayload> => {
    const res = await context.models.Image.deleteLabels(input);
    return { isOk: res.ok };
  },
};
