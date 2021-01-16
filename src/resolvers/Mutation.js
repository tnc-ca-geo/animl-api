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
    console.log('trying to create camera from Mutation.createImage() with image: ', newImage)
    await context.models.Camera.createCamera(newImage);
    await detectObjects(newImage);
    // return value must match CreateImagePayload schema
    return { image: newImage };
  },
  createView: async (_, { input }, context) => {
    const newView = await context.models.View.createView(input);
    return { view: newView };
  },
  // updateViewFilters: async (_, { input }, context) => {
  //   // find view
  //   // replace it's filters
  //   // save
  //   return { view: view };
  // },
};

module.exports = Mutation;