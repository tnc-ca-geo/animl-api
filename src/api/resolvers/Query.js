const Query = {
  images: async (_, args, context) => {
    const count = await context.models.Image.countImages(args.input);
    const response = await context.models.Image.queryByFilter(args.input);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {  // reurn ImagesConnection 
      pageInfo: {
        previous,
        hasPrevious, 
        next,
        hasNext,
        count,
      },
      images: results
    }
  },

  image: async (_, args, context) => {
    // Example role checking:
    // if (!context.user || !context.user.roles.includes('admin')) return null;
    return await context.models.Image.queryById(args.input._id);
  },

  labels: async (_, __, context) => {
    return await context.models.Image.getLabels();
  },
  
  cameras: async (_, { _ids }, context) => {
    return await context.models.Camera.getCameras(_ids);
  },

  views: async (_, { _ids }, context) => {
    return await context.models.View.getViews(_ids);
  },

  models: async (_, { _ids }, context) => {
    return await context.models.Model.getModels(_ids);
  },
  
};

module.exports = Query;