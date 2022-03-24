const { ApolloError } = require('apollo-server-errors');
const utils = require('../db/models/utils');
const retry = utils.retryWrapper;

// TODO: Split this out by entity type

const Mutation = {

  createImage: async (_, { input }, context) => {
    const image = await context.models.Image.createImage(input, context);
    console.log(`createImage() - image: `, image);
    return { image };
  },

  registerCamera: async (_, { input }, context) => {
    // TODO AUTH - decide between cameraId and cameraSn and use consistently
    const res = await retry(
      context.models.Camera.registerCamera,
      input,
      context
    );
    console.log(`registerCamera() - res: `, res);
    return {
      success: res.ok,
      cameraId: input.cameraId,
      ...(res.project && { project: res.project }),
      ...(res.cameras && { cameras: res.cameras }),
      ...(res.rejectionInfo && { rejectionInfo: res.rejectionInfo })
    };
  },

  unregisterCamera: async (_, { input }, context) => {
    const res = await retry(
      context.models.Camera.unregisterCamera,
      input,
      context
    );
    console.log(`unregisterCamera() - res: `, res);
    return { 
      success: res.ok,
      cameraId: input.cameraId,
      ...(res.cameras && { cameras: res.cameras }),
      ...(res.rejectionInfo && { rejectionInfo: res.rejectionInfo })
    };
  },

  createView: async (_, { input }, context) => {
    const view = await retry(context.models.Project.createView, input);
    return { view };
  },

  updateView: async (_, { input }, context) => {
    const view = await retry(context.models.Project.updateView, input);
    return { view };
  },

  deleteView: async (_, { input }, context) => {
    const project = await retry(context.models.Project.deleteView, input);
    return { project };
  },

  createDeployment: async (_, { input }, context) => {
    const cameraConfig = await retry(
      context.models.Project.createDeployment,
      input,
      context
    );
    return { cameraConfig };
  },

  updateDeployment: async (_, { input }, context) => {
    const cameraConfig = await retry(
      context.models.Project.updateDeployment,
      input,
      context
    );
    return { cameraConfig };
  },

  deleteDeployment: async (_, { input }, context) => {
    const cameraConfig = await retry(
      context.models.Project.deleteDeployment,
      input,
      context
    );
    return { cameraConfig };
  },

  // updateObjects: async (_, { input }, context) => {
  //   const image = await context.models.Image.updateObjects(input);
  //   return { image: image };
  // },

  createObject: async (_, { input }, context) => {
    const image = await retry(context.models.Image.createObject, input);
    return { image };
  },

  updateObject: async (_, { input }, context) => {
    const image = await retry(context.models.Image.updateObject, input);
    return { image };
  },

  deleteObject: async (_, { input }, context) => {
    const image = await retry(context.models.Image.deleteObject, input);
    return { image };
  },

  createLabels: async (_, { input }, context) => {
    const image = await retry(
      context.models.Image.createLabels,
      input,
      context
    );
    return { image };
  },

  updateLabel: async (_, { input }, context) => {
    const image = await retry(context.models.Image.updateLabel, input);
    return { image };
  },

  deleteLabel: async (_, { input }, context) => {
    const image = await retry(context.models.Image.deleteLabel, input);
    return { image };
  },

};

module.exports = Mutation;