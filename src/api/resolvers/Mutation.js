const utils = require('../db/models/utils');

// TODO: Split this out by entity type

const Mutation = {
  createImage: async (_, { input }, context) => {
    const md = utils.sanitizeMetadata(input.md, context.config);

    // find camera record (or create new one)
    const cameraSn = md.serialNumber;
    const existingCam = await context.models.Camera.getCameras([cameraSn]);
    const newCam = (existingCam.length === 0)
      ? await context.models.Camera.createCamera(md)
      : null;

    // if existing cam, find deployment
    md.deploymentId = newCam 
      ? newCam.deployments[0]._id
      : utils.mapImageToDeployment(md, existingCam[0]);

    // create image record
    newImage = await context.models.Image.createImage(md, context);
    return { image: newImage }; // return values must match payload schema
  },

  createView: async (_, { input }, context) => {
    const newView = await context.models.View.createView(input);
    return { view: newView };
  },

  updateView: async (_, { input }, context) => {
    const view = await context.models.View.updateView(input);
    return { view: view };
  },

  deleteView: async (_, { input }, context) => {
    const res = await context.models.View.deleteView(input);
    return { success: res.ok, viewId: input._id};
  },

  // updateObjects: async (_, { input }, context) => {
  //   const image = await context.models.Image.updateObjects(input);
  //   return { image: image };
  // },

  createObject: async (_, { input }, context) => {
    const image = await context.models.Image.createObject(input);
    return { image: image };
  },

  updateObject: async (_, { input }, context) => {
    const image = await context.models.Image.updateObject(input);
    return { image: image };
  },

  deleteObject: async (_, { input }, context) => {
    const image = await context.models.Image.deleteObject(input);
    return { image: image };
  },

  createLabels: async (_, { input }, context) => {
    const image = await context.models.Image.createLabels(input, context);
    return { image: image };
  },

  updateLabel: async (_, { input }, context) => {
    const image = await context.models.Image.updateLabel(input);
    return { image: image };
  },

  deleteLabel: async (_, { input }, context) => {
    const image = await context.models.Image.deleteLabel(input);
    return { image: image };
  },

  createDeployment: async (_, { input }, context) => {
    console.log('createDeployment mutation firing with input: ', input);
    const camera = await context.models.Camera.createDeployment(input, context);
    return { camera: camera };
  },

  updateDeployment: async (_, { input }, context) => {
    const camera = await context.models.Camera.updateDeployment(input, context);
    return { camera: camera };
  },

  deleteDeployment: async (_, { input }, context) => {
    const camera = await context.models.Camera.deleteDeployment(input, context);
    return { camera: camera };
  },

};

module.exports = Mutation;