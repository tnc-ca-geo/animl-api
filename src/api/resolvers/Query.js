const Query = {
  projects: async (_, { _ids }, context) => {
    return await context.models.Project.getProjects(_ids);
  },

  batches: async (_, { input }, context) => {
    const response = await context.models.Batch.queryByFilter(input);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {  // reurn ImagesConnection
      pageInfo: {
        previous,
        hasPrevious,
        next,
        hasNext
      },
      batches: results
    };
  },

  batch: async (_, { _id }, context) => {
    return await context.models.Batch.queryById(_id, {
      remaining: true
    });
  },

  images: async (_, { input }, context) => {
    const count = await context.models.Image.countImages(input);
    const response = await context.models.Image.queryByFilter(input);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {  // reurn ImagesConnection
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

  image: async (_, { input }, context) => {
    return await context.models.Image.queryById(input.imageId);
  },

  // TODO: Now fetching labels as a field level resolver for Project, but we
  // should reimplement this & call it when users create new label categories

  // labels: async (_, __, context) => {
  //   return await context.models.Image.getLabels();
  // },

  wirelessCameras: async (_, { _ids }, context) => {
    return await context.models.Camera.getWirelessCameras(_ids);
  },

  mlModels: async (_, { _ids }, context) => {
    return await context.models.MLModel.getMLModels(_ids);
  },

  stats: async (_, { input }, context) => {
    return await context.models.Image.getStats(input);
  },

  export: async (_, { input }, context) => {
    return await context.models.Image.export(input, context);
  },

  exportStatus: async (_, { input }, context) => {
    return await context.models.Image.getExportStatus(input, context);
  },

  priorityStatus: async (_, __, context) => {
    return await context.models.Batch.getPriorityStatus();
  }
};

module.exports = Query;
