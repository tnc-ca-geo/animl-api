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
  // Parse input when the type of input is JSON (e.g. input is passed into 
  // query as a JSON variable)
  parseValue(value) {
    console.log('parsing JSON date value: ', value);
    return moment(value, config.TIME_FORMATS.EXIF);
  },
  // Preparing the return value
  serialize(value) {
    console.log('serializing date value: ', value);
    return value.getTime(); // value sent to the client
  },
  // Parse input when the type of input is "inline" (AST)
  parseLiteral(ast) {
    console.log('parsing inline date value (ast): ', ast);
    // if (ast.kind === Kind.INT) {
    //   return parseInt(ast.value, 10); // ast value is always in string format
    // }
    // return null;
    return moment(ast.value, config.TIME_FORMATS.EXIF);
  },
});

module.exports = {
  Date,
}