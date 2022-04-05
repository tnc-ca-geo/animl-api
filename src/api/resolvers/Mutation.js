// TODO: Split this out by entity type

const Mutation = {

  createImage: async (_, { input }, context) => {
    const image = await context.models.Image.createImage(input, context);
    console.log(`Mutation.createImage() - image: `, image);
    return { image };
  },

  registerCamera: async (_, { input }, context) => {
    const res = await context.models.Camera.registerCamera(input, context);
    console.log(`registerCamera() - res: `, res);
    return { cameraId: input.cameraId, ...res };
  },

  unregisterCamera: async (_, { input }, context) => {
    const res = await context.models.Camera.unregisterCamera(input, context);
    console.log(`unregisterCamera() - res: `, res);
    return { cameraId: input.cameraId, ...res }
  },

  createView: async (_, { input }, context) => {
    const view = await context.models.Project.createView(input);
    return { view };
  },

  updateView: async (_, { input }, context) => {
    const view = await context.models.Project.updateView(input);
    return { view };
  },

  deleteView: async (_, { input }, context) => {
    const project = await context.models.Project.deleteView(input);
    return { project };
  },

  createDeployment: async (_, { input }, context) => {
    const cameraConfig = await context.models.Project.createDeployment(input);
    return { cameraConfig };
  },

  updateDeployment: async (_, { input }, context) => {
    const cameraConfig = await context.models.Project.updateDeployment(input);
    return { cameraConfig };
  },

  deleteDeployment: async (_, { input }, context) => {
    const cameraConfig = context.models.Project.deleteDeployment(input);
    return { cameraConfig };
  },

  // updateObjects: async (_, { input }, context) => {
  //   const image = await context.models.Image.updateObjects(input);
  //   return { image: image };
  // },

  createObject: async (_, { input }, context) => {
    const image = await context.models.Image.createObject(input);
    return { image };
  },

  updateObject: async (_, { input }, context) => {
    const image = await context.models.Image.updateObject(input);
    return { image };
  },

  deleteObject: async (_, { input }, context) => {
    const image = await context.models.Image.deleteObject(input);
    return { image };
  },

  createLabels: async (_, { input }, context) => {
    const image = await context.models.Image.createLabels(input, context);
    return { image };
  },

  updateLabel: async (_, { input }, context) => {
    const image = await context.models.Image.updateLabel(input);
    return { image };
  },

  deleteLabel: async (_, { input }, context) => {
    const image = context.models.Image.deleteLabel(input);
    return { image };
  },

};

module.exports = Mutation;