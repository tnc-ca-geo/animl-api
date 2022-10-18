const { DateTime } = require('luxon');
const { GraphQLScalarType } = require('graphql');
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
    // return DateTime.fromFormat(value, localConfig.TIME_FORMATS.EXIF);
    console.log('Date Scalar - parsing value: ', value);
    return DateTime.fromISO(value);
  },
  // Prep return value to be sent to client
  serialize(value) {
    // previously, we used value.getTime() and returned dates as UNIX timestamps
    // however, for consistency and to make sure that if those dates get sent
    // back to the API they get parsed correctly by parseValue(),
    // let's serialize all external dates in EXIF format

    // TODO TIMEZONE: is this worth revisiting? Perhaps convert all EXIF dates to
    // ISO 8601 in animl-ingest and use ISO outside of animl-api instead
    // of EXIF format? Assess all of the points at which Dates are getting
    // passed into graphQL as inputs and see if we can't run w/ ISO instead

    console.log('Date scalar - serialize() - original value: ', value);
    console.log('Date scalar - serialize() - modified value: ', DateTime.fromJSDate(value).toISO());
    return DateTime.fromJSDate(value).toISO();
    // return dt.toFormat(localConfig.TIME_FORMATS.EXIF);
  },
  // Parse input when the type of input is "inline" (AST)
  parseLiteral(ast) {

    // return DateTime.fromFormat(ast.value, localConfig.TIME_FORMATS.EXIF);
    console.log('Date Scalar - Parsing literal: ', ast);
    return DateTime.fromISO(ast.value);
  }
});

module.exports = {
  JSONObject,
  Date
};

