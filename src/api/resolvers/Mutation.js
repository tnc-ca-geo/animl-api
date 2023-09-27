const Mutation = {
  createBatchError: async (_, { input }, context) => {
    const error = await context.models.BatchError.createError(input, context);
    return { ...error };
  },

  createImageError: async (_, { input }, context) => {
    const error = await context.models.ImageError.createError(input, context);
    return { ...error };
  },

  clearImageErrors: async (_, { input }, context) => {
    const res = await context.models.ImageError.clearErrors(input, context);
    return { ...res };
  },

  clearBatchErrors: async (_, { input }, context) => {
    const res = await context.models.BatchError.clearErrors(input, context);
    return { ...res };
  },

  createUpload: async (_, { input }, context) => {
    const res = await context.models.Batch.createUpload(input, context);
    return { ...res };
  },

  updateUser: async (_, { input }, context) => {
    const res = await context.models.User.updateUer(input, context);
    return { ...res };
  },

  updateBatch: async (_, { input }, context) => {
    const batch = await context.models.Batch.updateBatch(input, context);
    return { batch };
  },

  redriveBatch: async (_, { input }, context) => {
    const res = await context.models.Batch.redriveBatch(input, context);
    return { ...res };
  },

  stopBatch: async (_, { input }, context) => {
    const res = await context.models.Batch.stopBatch(input, context);
    return { ...res };
  },

  createImage: async (_, { input }, context) => {
    const imageAttempt = await context.models.Image.createImage(input, context);
    return { imageAttempt };
  },

  deleteImage: async (_, { input }, context) => {
    const res = await context.models.Image.deleteImage(input, context);
    return { ... res };
  },

  deleteImages: async (_, { input }, context) => {
    const res = await context.models.Image.deleteImages(input, context);
    return { ... res };
  },

  registerCamera: async (_, { input }, context) => {
    const res = await context.models.Camera.registerCamera(input, context);
    return { ...res };
  },

  unregisterCamera: async (_, { input }, context) => {
    const res = await context.models.Camera.unregisterCamera(input, context);
    return { ...res };
  },

  createView: async (_, { input }, context) => {
    const view = await context.models.Project.createView(input, context);
    return { view };
  },

  updateView: async (_, { input }, context) => {
    const view = await context.models.Project.updateView(input, context);
    return { view };
  },

  deleteView: async (_, { input }, context) => {
    const project = await context.models.Project.deleteView(input, context);
    return { project };
  },

  updateAutomationRules: async (_, { input }, context) => {
    const automationRules = await context.models.Project.updateAutomationRules(input, context);
    return { automationRules };
  },

  createDeployment: async (_, { input }, context) => {
    const cameraConfig = await context.models.Project.createDeployment(input, context);
    return { cameraConfig };
  },

  updateDeployment: async (_, { input }, context) => {
    const cameraConfig = await context.models.Project.updateDeployment(input, context);
    return { cameraConfig };
  },

  deleteDeployment: async (_, { input }, context) => {
    const cameraConfig = await context.models.Project.deleteDeployment(input, context);
    return { cameraConfig };
  },

  createObjects: async (_, { input }, context) => {
    const res = await context.models.Image.createObjects(input, context);
    return { isOk: res.ok };
  },

  updateObjects: async (_, { input }, context) => {
    const res = await context.models.Image.updateObjects(input, context);
    return { isOk: res.ok };
  },

  deleteObjects: async (_, { input }, context) => {
    const res = await context.models.Image.deleteObjects(input, context);
    return { isOk: res.ok };
  },

  createLabels: async (_, { input }, context) => {
    const res = await context.models.Image.createLabels(input, context);
    return { isOk: res.ok };
  },

  updateLabels: async (_, { input }, context) => {
    const res = await context.models.Image.updateLabels(input, context);
    return { isOk: res.ok };
  },

  deleteLabels: async (_, { input }, context) => {
    const res = await context.models.Image.deleteLabels(input, context);
    return { isOk: res.ok };
  }

};

export default Mutation;
