const moment = require('moment');

// Not sure where this would go exactly. Maybe pass it into context?
const detectObjects = async (image) => {
  // TODO: hardcoded return value is just for testing 
  // integrate with megadetector endpoint here
  console.log('Detecting objects...');
  setTimeout(() => {
    const objects = [
      {
        type: 'ml',
        category: 'skunk',
        conf: 87.1,
        bbox: [1, 2],
        labeledDate: moment(),
        validation: {
          reviewed: false,
          validated: false,
        }
      }
    ];
    objects.forEach((object) => {
      image.labels.push(object);
    });
    image.save();
  }, 1000);
};

const Mutation = {
  createImage: async (_, { input }, context) => {
    const newImage = await context.models.Image.createImage(input);
    await context.models.Camera.createCamera(newImage);
    await detectObjects(newImage);
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
};

module.exports = Mutation;