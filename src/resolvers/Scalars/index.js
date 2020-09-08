const Date = require('./Date');
const GraphQLJSON = require('graphql-type-json');
const JSONObject = GraphQLJSON.GraphQLJSONObject;

module.exports = {
  JSONObject,
  ...Date,
};

