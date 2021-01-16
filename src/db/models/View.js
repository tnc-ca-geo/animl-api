const moment = require('moment');
const View = require('../schemas/View');
// const utils = require('./utils');
// const config = require('../../config/config');


const defaultViewConfig = {
  name: 'All images',
  filters: {},
  description: `Default view of all images. This view is not editable.`,
};

const generateViewModel = () => ({

  createView: async (input) => {
    try {
      console.log('Creating new view: ', input.name);
      const newView = new View(input)
      console.log(newView);
      await newView.save();
      return newView;
    } catch (err) {
      throw new Error(err);
    }
  },

  get getViews() {  // use object getter so we can reference this.createView
    return async () => {
      try {
        const views = await View.find({});
        console.log('found views: ', views);
        if (views.length === 0) {
          defaultView = await this.createView(defaultViewConfig);
          views.push(defaultView);
        }
        return views;
      } catch (err) {
        throw new Error(err);
      }
    }
  },
  
 });

module.exports = generateViewModel;



// TODO: pass user into model generators to perform authorization at the 
// data fetching level. e.g.:
// export const generateViewModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
