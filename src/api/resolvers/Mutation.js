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
      console.log(`createImage() - Found camera - ${existingCam}`);

      // NEW - find current project registration
      const activeProjReg = existingCam[0].projRegistrations.find((proj) => (
        proj.active
      ));
      if (!activeProjReg) {
        const err = `Can't find active project registration for image: ${md}`;
        throw new ApolloError(err);
      }
      console.log(`createImage() - Found active project registration - ${activeProjReg.project}`);
      projectId = activeProjReg.project;
    }
    else {
      console.log(`createImage() - Couldn't find a camera for image, so creating new one...`);
      const input = {
        projectId,
        cameraId: cameraSn,
        make: md.make,
        ...(md.model && { model: md.model }),
      };
      const res = await retry(
        context.models.Camera.createCamera,
        input,
        context
      );
      console.log(`createImage() - newCam: `, res.newCam);
    }

    // NEW - map image to deployment
    const projects = await context.models.Project.getProjects([projectId]);
    console.log(`createImage() - found project: ${projects[0]}`);
    const camConfig = projects[0].cameras.find((cam) => 
      cam._id.toString() === cameraSn.toString()
    );
    const deploymentId = utils.mapImageToDeployment(md, camConfig);
    console.log(`createImage() - mapped to deployment: ${deploymentId}`);

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
    console.log(`registerCamera() - res: `, res);
    return { 
      success: res.ok,
      cameraId: input.cameraId,
      ...(res.project && { project: res.project }),
      ...(res.rejectionInfo && { rejectionInfo: res.rejectionInfo })
    };
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
    const proj = await retry(context.models.Project.deleteView, input);
    return { project: proj };
  },

  createDeployment: async (_, { input }, context) => {
    const cameraConfig = await retry(
      context.models.Project.createDeployment,
      input,
      context
    );
    return { cameraConfig: cameraConfig };
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