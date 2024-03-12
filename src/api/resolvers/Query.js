const Query = {
  projects: async (_, { input }, context) => {
    return await context.models.Project.getProjects(input, context);
  },

  users: async (_, { input }, context) => {
    return await context.models.User.listUsers(input, context);
  },

  tasks: async (_, { input }, context) => {
    const response = await context.models.Task.queryByFilter(input, context);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext
      },
      tasks: results
    };
  },

  batches: async (_, { input }, context) => {
    const response = await context.models.Batch.queryByFilter(input, context);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext
      },
      batches: results
    };
  },

  images: async (_, { input }, context) => {
    const count = await context.models.Image.countImages(input, context);
    const response = await context.models.Image.queryByFilter(input, context);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext,
        count
      },
      images: results
    };
  },

  imageErrors: async (_, { input }, context) => {
    const count = await context.models.ImageError.countImageErrors(input, context);
    const response = await context.models.ImageError.queryByFilter(input, context);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext,
        count
      },
      errors: results
    };
  },

  image: async (_, { input }, context) => {
    return await context.models.Image.queryById(input.imageId, context);
  },

  wirelessCameras: async (_, { input }, context) => {
    return await context.models.Camera.getWirelessCameras(input, context);
  },

  mlModels: async (_, { input }, context) => {
    return await context.models.MLModel.getMLModels(input, context);
  },

  stats: async (_, { input }, context) => {
    return await context.models.Image.getStats(input, context);
  },

  exportErrors: async (_, { input }, context) => {
    return await context.models.ImageError.export(input, context);
  },

  export: async (_, { input }, context) => {
    return await context.models.Image.export(input, context);
  },

  exportStatus: async (_, { input }, context) => {
    return await context.models.Image.getExportStatus(input, context);
  }
};

export default Query;
