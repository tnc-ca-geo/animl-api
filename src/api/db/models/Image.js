const { ApolloError } = require('apollo-server-errors');
const { DuplicateError, DBValidationError } = require('../../errors');
const Image = require('../schemas/Image');
const automation = require('../../../automation');
const utils = require('./utils');
const { labels } = require('../../resolvers/Query');
const { __Directive } = require('graphql');

const generateImageModel = ({ user } = {}) => ({

  countImages: async (input) => {
    console.log(`ImageModel.countImages() - `);
    const query = utils.buildFilter(input, user);
    const count = await Image.where(query).countDocuments();
    return count;
  },

  queryById: async (_id) => {
    console.log(`ImageModel.queryById() - _id: ${_id}`);
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
        query: utils.buildFilter(input, user),
        limit: input.limit,
        paginatedField: input.paginatedField,
        sortAscending: input.sortAscending,
        next: input.next,
        previous: input.previous,
      };
      console.log(`ImageModel.queryByFilter() - options: ${JSON.stringify(options)}`);
      const result = await Image.paginate(options);
      return result;
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  // TODO: this should be called getAllCategories or something like that
  getLabels: async (projId) => {
    try {
      console.log(`ImageModel.getLabels() - projId: ${projId}`);

      const categoriesAggregate = await Image.aggregate([
        { $match: {'project': projId} }, // NEW - limit aggregation to specific project
        { $unwind: '$objects' },
        { $unwind: '$objects.labels' },
        { $match: {'objects.labels.validation.validated': {$not: {$eq: false}}}},
        { $group: {_id: null, uniqueCategories: {
            $addToSet: "$objects.labels.category"
        }}}
      ]);
      if (categoriesAggregate.length === 0) {
      }
      let categories = categoriesAggregate.length
        ? categoriesAggregate[0].uniqueCategories
        : [];

      const labellessImage = await Image.findOne(
        { project: projId, objects: { $size: 0 } }
      );
      if (labellessImage) categories.push('none');
      console.log(`ImageModel.getLabels() - categories: ${categories}`);
      return { categories };
    } catch (err) {
      throw new ApolloError(err);
    }
  },

  createImage: async (md, context) => {
    console.log(`ImageModel.createImage() - md: ${JSON.stringify(md)}`);
    try {
      const newImage = utils.createImageRecord(md);
      // TODO: fix error handling bug here - if image successfully saves
      // and then an error gets thrown in automation.eventHandler, 
      // retryWrapper retries this whole function again (including save image)
      // but it gets rejected b/c the image is now a duplicate
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

  get createObject() {
    return async (input, context) => {
      console.log(`ImageModel.createObject() - input: ${input}`);
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
      console.log(`ImageModel.updateObject() - input: ${input}`);
      const { imageId, objectId, diffs } = input;
      try {
        const image = await this.queryById(imageId);
        console.log(`Found image, version number: ${image.__v}`);
        const object = image.objects.find((obj) => (
          obj._id.toString() === objectId.toString()
        ));
        if (!object) {
          throw `Could not find object "${objectId}" on image "${imageId}"`;
        }
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
      console.log(`ImageModel.deleteObject() - input: ${input}`);
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

  // TODO AUTH - createLabel can be executed by superuser (if ML predicted label) 
  // do we need to know what project the label belongs to? if so how do we determine that?
  get createLabels() {
    return async (input, context) => {
      console.log(`ImageModel.createLabels() - input: ${JSON.stringify(input)}`);
      const { imageId, objectId, labels } = input;
      try {
        const image = await this.queryById(imageId);
        for (const label of labels) {
          if (utils.isLabelDupe(image, label)) return;

          const authorId = label.mlModel || label.userId;
          const labelRecord = utils.createLabelRecord(label, authorId);

          if (objectId) {
            // if objectId specified, find that object and save label to it
            const object = image.objects.find((obj) => (
              obj._id.toString() === objectId.toString()
            ));
            object.labels.unshift(labelRecord);
          }
          else {
            // else try to match to existing object bbox
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
          
          if (label.mlModel) {
            await automation.handleEvent({
              event: 'label-added',
              image: image,
              label: labelRecord,
            }, context);
          }
        }
        return image;
      } catch (err) {
        throw new ApolloError(err);
      }
    }
  },

  get updateLabel() {
    return async (input, context) => {
      console.log(`ImageModel.updateLabel() - input: ${input}`);
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
      console.log(`ImageModel.deleteLabel() - input: ${input}`);
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
