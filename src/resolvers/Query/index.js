const HelloQuery = require('./HelloQuery');
const TodoQuery = require('./TodoQuery');

module.exports = {
  ...HelloQuery,
  ...TodoQuery
};

