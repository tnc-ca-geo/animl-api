const Query = {

  projects: async (_, { _ids }, context) => {
    return await context.models.Project.getProjects(_ids);
  },

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
    return await context.models.Image.queryById(args.input._id);
  },

  // Now fetching labels as a field level resolver for Project
  // labels: async (_, __, context) => {
  //   return await context.models.Image.getLabels();
  // },
  
  cameras: async (_, { _ids }, context) => {
    return await context.models.Camera.getCameras(_ids);
  },

  views: async (_, { _ids }, context) => {
    // TODO AUTH - not sure we'll need this anymore b/c we're getting views
    // from Project.views
    return await context.models.View.getViews(_ids);
  },

  // TODO: rename mlModels
  models: async (_, { _ids }, context) => {
    return await context.models.MLModel.getMLModels(_ids);
  },
  
};

module.exports = Query;