// const User = require('../../db/models/User');
// const { authenticate } = require('../../utils/utils');

// Temporarily hardoding some data...
const todosData = [
  {
    _id: '1234',
    content: 'some todo',
  },
  {
    _id: '456',
    content: 'some other todo',
  },
  {
    _id: '7893',
    content: 'more todo',
  },
]

const todos = async (parent, args, context) => {
  // const userId = authenticate(context);
  try {
    // const user = await User.findOne({ _id: userId }).lean();
    console.log('looking for todos: ', todosData);
    return todosData;
  } catch (err) {
    throw new Error(err);
  }
};

const todo = async (parent, { _id }, context) => {
  // const userId = authenticate(context);
  try {
    // const user = await User.findOne({ _id: userId }).lean();
    // const todo = await user.todos.find(
    //   todo => todo._id.toString() === _id
    // );
    const todo = await todosData.find(
      todo => todo._id.toString() === _id
    );
    console.log('found todo: ', todo)
    return todo;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  todos,
  todo,
};
