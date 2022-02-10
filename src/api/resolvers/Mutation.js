const { ApolloError } = require('apollo-server-errors');
const utils = require('../db/models/utils');
const retry = utils.retryWrapper;

// TODO: Split this out by entity type

const Mutation = {
  
  createImage: async (_, { input }, context) => {
    const md = utils.sanitizeMetadata(input.md, context.config);
    let projectId = 'default_project';

    console.log(`createImage() - `, md);

    // NEW - find camera record (or create new one)
    const cameraSn = md.serialNumber;
    const existingCam = await context.models.Camera.getCameras([cameraSn]);
    if (existingCam.length > 0) {
      console.log(`Found camera - ${existingCam}`);

      // NEW - find current project registration
      const projReg = existingCam[0].projRegistrations.find((proj) => (
        proj.active
      ));
      if (!projReg) {
        const err = `Can't find active project registration for image: ${md}`;
        throw new ApolloError(err);
      }
      console.log(`Found current project registration - ${projReg.project}`);
      projectId = projReg.project;
    }
    else {
      console.log(`Couldn't find a camera for image, so creating new one...`);
      const input = {
        project: projectId,
        cameraSn: md.serialNumber,
        make: md.make,
        ...(md.model && { model: md.model }),
      };
      const newCam = await retry(
        context.models.Camera.createCamera,
        input,
        context
      );
    }

    // NEW - map image to deployment
    const project = await context.models.Project.getProjects([projectId]);
    const camConfig = project.cameras.find((cam) => 
      cam._id.toString() === cameraSn.toString()
    );
    const deploymentId = utils.mapImageToDeployment(md, camConfig);

    // create image record
    md.project = projectId;
    md.deployment = deploymentId;
    newImage = await retry(context.models.Image.createImage, md, context);
    return { image: newImage };
  },

  // NEW
  registerCamera: async(_, { input }, context) => {
    // TODO AUTH - decide between cameraId and cameraSn and use consistently
    const res = await retry(
      context.models.Camera.registerCamera,
      input,
      context
    );
    return { success: res.ok, cameraId: input.cameraId };
  },

  // TODO AUTH - create unregisterCamera() handler

  createView: async (_, { input }, context) => {
    const newView = await retry(context.models.Project.createView, input);
    return { view: newView };
  },

  updateView: async (_, { input }, context) => {
    const view = await retry(context.models.Project.updateView, input);
    return { view: view };
  },

  deleteView: async (_, { input }, context) => {
    const res = await retry(context.models.Project.deleteView, input);
    return { success: res.ok, viewId: input._id };
  },

  createDeployment: async (_, { input }, context) => {
    const cameraConfig = await retry(
      context.models.Project.createDeployment,
      input,
      contex
    );
    return { camera: cameraConfig };
  },

  updateDeployment: async (_, { input }, context) => {
    const cameraConfig = await retry(
      context.models.Project.updateDeployment,
      input,
      context
    );
    return { cameraConfig: cameraConfig };
  },

  deleteDeployment: async (_, { input }, context) => {
    const cameraConfig = await retry(
      context.models.Project.deleteDeployment,
      input,
      context
    );
    return { cameraConfig: cameraConfig };
  },

  // updateObjects: async (_, { input }, context) => {
  //   const image = await context.models.Image.updateObjects(input);
  //   return { image: image };
  // },

  createObject: async (_, { input }, context) => {
    const image = await retry(context.models.Image.createObject, input);
    return { image: image };
  },

  updateObject: async (_, { input }, context) => {
    const image = await retry(context.models.Image.updateObject, input);
    return { image: image };
  },

  deleteObject: async (_, { input }, context) => {
    const image = await retry(context.models.Image.deleteObject, input);
    return { image: image };
  },

  createLabels: async (_, { input }, context) => {
    const image = await retry(
      context.models.Image.createLabels,
      input,
      context
    );
    return { image: image };
  },

  updateLabel: async (_, { input }, context) => {
    const image = await retry(context.models.Image.updateLabel, input);
    return { image: image };
  },

  deleteLabel: async (_, { input }, context) => {
    const image = await retry(context.models.Image.deleteLabel, input);
    return { image: image };
  },

};

module.exports = Mutation;