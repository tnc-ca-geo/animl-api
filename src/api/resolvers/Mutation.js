const utils = require('../db/models/utils');

const Mutation = {
  createImage: async (_, { input }, context) => {
    // NOTE: This is currently parsed twice to check for camera authorization
    const md = utils.sanitizeMetadata(input.md, context.config);
    let newImage = utils.createImageRecord(md);
    await context.models.Camera.createCamera(newImage);

    newImage = await context.models.Image.createImage(input, context);
    return { image: newImage }; // return values must match payload schema
  },

  createLabels: async (_, { input }, context) => {
    // TODO: accomodate both ml & user-created labels
    console.log('createLabel mutation firing with input: ', input);
    const image = await context.models.Image.createLabels(input, context);
    return { image: image };
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

};

module.exports = Mutation;