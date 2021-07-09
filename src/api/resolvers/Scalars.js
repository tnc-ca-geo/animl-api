const moment = require('moment');
const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');
const GraphQLJSON = require('graphql-type-json');
const JSONObject = GraphQLJSON.GraphQLJSONObject;
const { localConfig } = require('../../config/config');

// Good explanation of the difference between 
// parseValue(), serialize(), and parseLiteral() here:
// https://stackoverflow.com/questions/41510880/whats-the-difference-between-parsevalue-and-parseliteral-in-graphqlscalartype
const Date = new GraphQLScalarType({
  name: 'Date',
  description: 'Date scalar type',
  // Parse input when the type of input is JSON 
  // e.g. input is passed into query as a JSON variable
  parseValue(value) {
    return moment(value, localConfig.TIME_FORMATS.EXIF);
  },
  // Prep return value to be sent to client
  serialize(value) {
    // previously, we used value.getTime() and returned dates as UNIX timestamps
    // however, for consistency and to make sure that if those dates get sent
    // back to the API they get parsed correctly by parseValue(), 
    // let's serialize all external dates in EXIF format
    return moment(value).format(localConfig.TIME_FORMATS.EXIF);
  },
  // Parse input when the type of input is "inline" (AST)
  parseLiteral(ast) {
    return moment(ast.value, localConfig.TIME_FORMATS.EXIF);
  },
});

module.exports = {
  JSONObject,
  Date,
};

