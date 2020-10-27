const Query = {
  images: async (_, args, context) => {
    console.log('resolving Query.images() with args: ', args);
    const count = await context.models.Image.countImages(args.input);
    const response = await context.models.Image.queryByFilter(args.input);
    const { previous, hasPrevious, next, hasNext, results } = response;

    // reurn ImageConnection 
    return {
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
  cameras: async (_, { _ids }, context) => {
    return (_ids) 
      ? context.models.Camera.queryByIds(_ids)
      : context.models.Camera.getAll();
  },
};

module.exports = Query;