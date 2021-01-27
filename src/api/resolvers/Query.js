const Query = {
  images: async (_, args, context) => {
    const count = await context.models.Image.countImages(args.input);
    const response = await context.models.Image.queryByFilter(args.input);
    const { previous, hasPrevious, next, hasNext, results } = response;
    return {  // reurn ImageConnection 
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

  image: async (_, { _id }, context) => {
    // Example role checking:
    // if (!context.user || !context.user.roles.includes('admin')) return null;
    return context.models.Image.queryById(_id);
  },

  labels: async (_, __, context) => {
    return context.models.Image.getLabels();
  },
  
  cameras: async (_, { _ids }, context) => {
    return context.models.Camera.getCameras(_ids);
  },

  views: async (_, { _ids }, context) => {
    return context.models.View.getViews(_ids);
  },
};

module.exports = Query;