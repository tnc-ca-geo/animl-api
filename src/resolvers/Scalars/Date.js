const moment = require('moment');
const { GraphQLScalarType } = require('graphql');
const { Kind } = require('graphql/language');
const config = require('../../config/config');

// Good explanation of the difference between 
// parseValue(), serialize(), and parseLiteral() here:
// https://stackoverflow.com/questions/41510880/whats-the-difference-between-parsevalue-and-parseliteral-in-graphqlscalartype
const Date = new GraphQLScalarType({
  name: 'Date',
  description: 'Date scalar type',
  // Parse input when the type of input is JSON 
  // e.g. input is passed into query as a JSON variable
  parseValue(value) {
    return moment(value, config.TIME_FORMATS.EXIF);
  },
  // Preparing the return value to be sent to client
  serialize(value) {
    console.log('serializing date value: ', value);
    return value.getTime();
  },
  // Parse input when the type of input is "inline" (AST)
  parseLiteral(ast) {
    return moment(ast.value, config.TIME_FORMATS.EXIF);
  },
});

module.exports = {
  Date,
}