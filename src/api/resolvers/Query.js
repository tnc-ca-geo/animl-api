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

  // TODO: Now fetching labels as a field level resolver for Project, but we 
  // should reimplement this & call it when users create new label categories

  // labels: async (_, __, context) => {
  //   return await context.models.Image.getLabels();
  // },
  
  cameras: async (_, { _ids }, context) => {
    return await context.models.Camera.getCameras(_ids);
  },

  mlModels: async (_, { _ids }, context) => {
    return await context.models.MLModel.getMLModels(_ids);
  },
  
};

module.exports = Query;