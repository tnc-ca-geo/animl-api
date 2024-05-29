import { Context } from '../db/models/utils.js';
import { QLInput } from './utils.js';
import * as graphql from '../../generated/graphql.js';

const Query = {
  projects: async (
    _: unknown,
    { input }: QLInput<graphql.QueryProjectsInput>,
    context: Context,
  ) => {
    return await context.models.Project.getProjects(input, context);
  },

  users: async (_: unknown, { input }: QLInput<graphql.QueryUsersInput>, context: Context) => {
    return await context.models.User.listUsers(input, context);
  },

  tasks: async (_: unknown, { input }: QLInput<graphql.QueryTasksInput>, context: Context) => {
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

  task: async (_: unknown, { input }: QLInput<graphql.QueryTaskInput>, context: Context) => {
    return await context.models.Task.queryById(input.taskId, context);
  },

  batches: async (_: unknown, { input }: QLInput<graphql.QueryBatchesInput>, context: Context) => {
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

  images: async (_: unknown, { input }: QLInput<graphql.QueryImagesInput>, context: Context) => {
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
    { input }: QLInput<graphql.QueryImagesCountInput>,
    context: Context,
  ) => {
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
    { input }: QLInput<graphql.QueryImageErrorsInput>,
    context: Context,
  ) => {
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

  image: async (_: unknown, { input }: QLInput<graphql.QueryImageInput>, context: Context) => {
    return await context.models.Image.queryById(input.imageId, context);
  },

  wirelessCameras: async (
    _: unknown,
    { input }: QLInput<graphql.QueryWirelessCamerasInput>,
    context: Context,
  ) => {
    return await context.models.Camera.getWirelessCameras(input, context);
  },

  mlModels: async (
    _: unknown,
    { input }: QLInput<graphql.QueryMlModelsInput>,
    context: Context,
  ) => {
    return await context.models.MLModel.getMLModels(input);
  },

  stats: async (_: unknown, { input }: QLInput<graphql.QueryStatsInput>, context: Context) => {
    return await context.models.Image.getStats(input, context);
  },

  exportErrors: async (
    _: unknown,
    { input }: QLInput<graphql.QueryExportErrorsInput>,
    context: Context,
  ) => {
    return await context.models.ImageError.exportErrors(input, context);
  },

  exportAnnotations: async (
    _: unknown,
    { input }: QLInput<graphql.QueryExportInput>,
    context: Context,
  ) => {
    return await context.models.Image.exportAnnotations(input, context);
  },
};

export default Query;
