const TodoMutation = require('./TodoMutation');
const ImageMutation = require('./ImageMutation');

module.exports = {
  ...TodoMutation,
  ...ImageMutation,
};
