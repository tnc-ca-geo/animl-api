const { ApolloError } = require('apollo-server-errors');
const { DuplicateError, DBValidationError } = require('../../errors');
const Image = require('../schemas/Image');
const automation = require('../../../automation');
const utils = require('./utils');
const { labels } = require('../../resolvers/Query');
const { __Directive } = require('graphql');

const generateImageModel = ({ user } = {}) => ({

  countImages: async (input) => {
    const query = utils.buildFilter(input);
    const count = await Image.where(query).countDocuments();
    return count;
  },

  queryById: async (_id) => {
    try {
      const image = await Image.findOne({_id});
      return image;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  queryByFilter: async (input) => {
    try {
      const options = {
        query: utils.buildFilter(input),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      };
      const result = await Image.paginate(options);
      return result;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // TODO: this should be called getAllCategories or something like that
  getLabels: async () => {
    try {
      const categoriesAggregate = await Image.aggregate([
        {$unwind: '$objects'},
        {$unwind: '$objects.labels'},
        {$match: {'objects.labels.validation.validated': {
          $not: {$eq: false}}}
        },
        {$group: {_id: null, uniqueCategories: {
          $addToSet: "$objects.labels.category"
        }}}
      ]);
      let categories = categoriesAggregate[0].uniqueCategories;
      const labellessImage = await Image.findOne({ objects: { $size: 0 } });
      if (labellessImage) {
        categories.push('none');
      }
      return { categories };
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  createImage: async (md, context) => {
    try {
      console.log('createImage() - createImage in Image.model firing ')
      // const md = utils.sanitizeMetadata(input.md, context.config);
      const newImage = utils.createImageRecord(md);
      await newImage.save();
      await automation.handleEvent({
        event: 'image-added',
        image: newImage,
      }, context);
      return newImage;
    } catch (err) {
      if (err.message.toLowerCase().includes('duplicate')) {
        throw new DuplicateError(err);
      }
      else if (err.message.toLowerCase().includes('validation')) {
        throw new DBValidationError(err);
      }
      throw new ApolloError(err);
    }
  },

  // get updateObjects() {
  //   return async (input, context) => {
  //     const { imageId, objects } = input;
  //     try {
  //       const image = await this.queryById(imageId);
  //       console.log('updating objects on image: ', image.originalFileName);
  //       console.log('new objects: ', objects);
  //       objects.forEach((object) => {
  //         console.log('new labels: ', object.labels);
  //         object.labels.forEach((label) => {
  //           console.log('label: ', label);
  //           console.log('validation: ', label.validation)
  //         })
  //       });
  //       image.objects = objects;
  //       await image.save();
  //       return image;
  //     } catch (err) {
  //       throw new ApolloError(err);
  //     }
  //   }
  // },

  get createObject() {
    return async (input, context) => {
      console.log('createObject() - creating object with input: ', input);
      const { imageId, object } = input;
      try {
        const image = await this.queryById(imageId);
        image.objects.unshift(object);
        await image.save();
        return image;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get updateObject() {
    return async (input, context) => {
      console.log('updateObject() - updating object with input: ', input);
      const { imageId, objectId, diffs } = input;
      try {
        const image = await this.queryById(imageId);
        console.log('updateObject() - found the image: ', image);
        const object = image.objects.find((obj) => (
          obj._id.toString() === objectId.toString()
        ));
        console.log('updateObject() - found the object: ', object);
        for (let [key, newVal] of Object.entries(diffs)) {
          object[key] = newVal;
        }
        await image.save();
        return image;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get deleteObject() {
    return async (input, context) => {
      console.log('deleteObject() - deleting object with input: ', input);
      const { imageId, objectId } = input;
      try {
        const image = await this.queryById(imageId);
        const newObjects = image.objects.filter((obj) => (
          obj._id.toString() !== objectId.toString()
        ));
        image.objects = newObjects;
        await image.save();
        return image;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get createLabels() {
    return async (input, context) => {
      console.log('createLabels() - creating labels firing with input: ', input);
      const { imageId, objectId, labels } = input;
      try {
        const image = await this.queryById(imageId);
        for (const label of labels) {
          if (utils.isLabelDupe(image, label)) {
            return;
          }

          const authorId = label.modelId || label.userId;
          const labelRecord = utils.createLabelRecord(label, authorId);

          if (objectId) {
            console.log('objectId specified, so finding that object and saving label to it')
            const object = image.objects.find((obj) => (
              obj._id.toString() === objectId.toString()
            ));
            object.labels.unshift(labelRecord);
          }
          else {
            let objExists = false;
            for (const object of image.objects) {
              if (_.isEqual(object.bbox, label.bbox)) {
                object.labels.unshift(labelRecord);
                objExists = true;
                break;
              }
            }
            if (!objExists) {
              image.objects.unshift({
                bbox: labelRecord.bbox,
                locked: false,
                labels: [labelRecord],
              });
            }
          }

          await image.save();
          
          if (label.modelId) {
            await automation.handleEvent({
              event: 'label-added',
              image: image,
              label: labelRecord,
            }, context);
          }
        }
        console.log(`createLabels success. Returning`);
        return image;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get updateLabel() {
    return async (input, context) => {
      console.log('updateLabel() - update label with input: ', input);
      const { imageId, objectId, labelId, diffs } = input;
      try {
        const image = await this.queryById(imageId);
        const object = image.objects.find((obj) => (
          obj._id.toString() === objectId.toString()
        ));
        const label = object.labels.find((lbl) => (
          lbl._id.toString() === labelId.toString()
        ));
        for (let [key, newVal] of Object.entries(diffs)) {
          label[key] = newVal;
        }
        await image.save();
        return image;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get deleteLabel() {
    return async (input, context) => {
      console.log('deleteLabel() - delete label with input: ', input);
      const { imageId, objectId, labelId } = input;
      try {
        const image = await this.queryById(imageId);
        const object = image.objects.find((obj) => (
          obj._id.toString() === objectId.toString()
        ));
        const newLabels = object.labels.filter((lbl) => (
          lbl._id.toString() !== labelId.toString()
        ));
        object.labels = newLabels;
        await image.save();
        return image;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

 });

module.exports = generateImageModel;


// TODO: pass user into model generators to perform authorization at the
// data fetching level. e.g.:
// export const generateImageModel = ({ user }) => ({
//   getAll: () => {
//     if(!user || !user.roles.includes('admin')) return null;
//     return fetch('http://myurl.com/users');
//    },
//   ...
// });
