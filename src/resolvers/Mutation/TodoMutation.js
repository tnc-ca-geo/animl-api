const mongoose = require('mongoose');
const TodoModel = require('../../db/models/Todo');
// const { authenticate } = require('../../utils/utils');
// const { ObjectId } = mongoose.Types;   // TODO: figure out how IDs work

const createTodo = async (_, { input }, context) => {
  console.log('Saving todo with input payload: ', input);
  // const userId = authenticate(context);
  try {
    const db = await context.connectToDatabase();
    // const user = await Todo.findOne({ _id: userId });
    // const newTodo = { _id: new ObjectId(), content };
    // user.todos.push(newTodo);
    // await user.save();
    const content = input.content;
    const newTodo = new TodoModel({ content });
    await newTodo.save();
    console.log('Successfully saved todo: ', newTodo);
    return newTodo;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  createTodo
};
