const mongoose = require('mongoose');
const ImageModel = require('../../db/models/Image');
const moment = require('moment');

const createImage = async (_, { input }, context) => {
  console.log('Saving image with input: ', input);
  try {
    const db = await context.connectToDatabase();
    // const user = await Todo.findOne({ _id: userId });
    // const newTodo = { _id: new ObjectId(), content };
    // user.todos.push(newTodo);
    // await user.save();
    input.dateAdded = moment();
    const newImage = new ImageModel({ ...input });
    await newImage.save();
    console.log('Successfully saved image: ', newImage);
    return newImage;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  createImage
};
