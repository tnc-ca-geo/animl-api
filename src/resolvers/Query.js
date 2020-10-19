const Query = {
  images: async (_, args, context) => {
    console.log('resolving Query.images() with args: ', args);
    // return context.models.Image.queryByFilter(args);
    const result = await context.models.Image.queryByFilter(args);
    // reurn ImageConnection 
    return {
      offset: result.offset,
      hasMore: result.hasNextPage,
      images: result.docs,
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