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
    const cameraConfig = context.models.Project.deleteDeployment(input, context);
    return { cameraConfig };
  },

  createObject: async (_, { input }, context) => {
    const image = await context.models.Image.createObject(input, context);
    return { image };
  },

  updateObjects: async (_, { input }, context) => {
    const res = await context.models.Image.updateObjects(input, context);
    return { isOk: res.ok };
  },

  deleteObject: async (_, { input }, context) => {
    const image = await context.models.Image.deleteObject(input, context);
    return { image };
  },

  createLabels: async (_, { input }, context) => {
    const image = await context.models.Image.createLabels(input, context);
    return { image };
  },

  updateLabels: async (_, { input }, context) => {
    const res = await context.models.Image.updateLabels(input, context);
    return { isOk: res.ok };
  },

  deleteLabel: async (_, { input }, context) => {
    const image = context.models.Image.deleteLabel(input, context);
    return { image };
  }

};

export default Mutation;
