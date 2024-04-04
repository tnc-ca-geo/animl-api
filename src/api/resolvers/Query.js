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

  task: async (_, { input }, context) => {
    return await context.models.Task.queryById(input.taskId, context);
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
    console.time('images query');
    const response = await context.models.Image.queryByFilter(input, context);
    console.timeEnd('images query');
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext
      },
      images: results
    };
  },

  imagesCount: async (_, { input }, context) => {
    console.log('imagesCount query - input: ', input);
    console.time('images count');
    const count = await context.models.Image.countImages(input, context);
    console.timeEnd('images count');
    return {
      count
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
    return await context.models.ImageError.exportErrors(input, context);
  },

  exportAnnotations: async (_, { input }, context) => {
    return await context.models.Image.exportAnnotations(input, context);
  }
};

export default Query;
