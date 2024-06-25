import type * as gql from '../../@types/graphql.js';
import { Context } from '../handler.js';

export default {
  projects: async (
    _: unknown,
    { input }: gql.QueryProjectsArgs,
    context: Context,
  ): Promise<gql.Project[]> => {
    return context.models.Project.getProjects(input, context);
  },

  users: async (
    _: unknown,
    { input }: gql.QueryUsersArgs,
    context: Context,
  ): Promise<gql.UsersPayload> => {
    return context.models.User.listUsers(input, context);
  },

  tasks: async (
    _: unknown,
    { input }: gql.QueryTasksArgs,
    context: Context,
  ): Promise<gql.TasksPayload> => {
    const response = await context.models.Task.queryByFilter(input, context);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext,
      },
      tasks: results,
    };
  },

  task: async (_: unknown, { input }: gql.QueryTaskArgs, context: Context): Promise<gql.Task> => {
    return context.models.Task.queryById(input.taskId, context);
  },

  batches: async (
    _: unknown,
    { input }: gql.QueryBatchesArgs,
    context: Context,
  ): Promise<gql.BatchesConnection> => {
    const response = await context.models.Batch.queryByFilter(input, context);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext,
      },
      batches: results,
    };
  },

  images: async (
    _: unknown,
    { input }: gql.QueryImagesArgs,
    context: Context,
  ): Promise<gql.ImagesConnection> => {
    console.time('images query');
    const response = await context.models.Image.queryByFilter(input, context);
    console.timeEnd('images query');
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext,
      },
      images: results,
    };
  },

  imagesCount: async (
    _: unknown,
    { input }: gql.QueryImagesCountArgs,
    context: Context,
  ): Promise<gql.ImagesCount> => {
    console.log('imagesCount query - input: ', input);
    console.time('images count');
    const count = await context.models.Image.countImages(input, context);
    console.timeEnd('images count');
    return {
      count,
    };
  },

  imageErrors: async (
    _: unknown,
    { input }: gql.QueryImageErrorsArgs,
    context: Context,
  ): Promise<gql.ImageErrorsConnection> => {
    const count = await context.models.ImageError.countImageErrors(input);
    const response = await context.models.ImageError.queryByFilter(input);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext,
        count,
      },
      errors: results,
    };
  },

  image: async (
    _: unknown,
    { input }: gql.QueryImageArgs,
    context: Context,
  ): Promise<gql.Image> => {
    return context.models.Image.queryById(input.imageId, context);
  },

  wirelessCameras: async (
    _: unknown,
    { input }: gql.QueryWirelessCamerasArgs,
    context: Context,
  ): Promise<gql.WirelessCamera[]> => {
    return context.models.Camera.getWirelessCameras(input, context);
  },

  mlModels: async (
    _: unknown,
    { input }: gql.QueryMlModelsArgs,
    context: Context,
  ): Promise<gql.MlModel[]> => {
    return context.models.MLModel.getMLModels(input);
  },

  stats: async (_: unknown, { input }: gql.QueryStatsArgs, context: Context): Promise<gql.Task> => {
    return context.models.Image.getStats(input, context);
  },

  exportErrors: async (
    _: unknown,
    { input }: gql.QueryExportErrorsArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.ImageError.exportErrors(input, context);
  },

  exportAnnotations: async (
    _: unknown,
    { input }: gql.QueryExportAnnotationsArgs,
    context: Context,
  ): Promise<gql.Task> => {
    return context.models.Image.exportAnnotations(input, context);
  },
};
