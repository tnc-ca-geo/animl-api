import { DateTime } from 'luxon';
import { GraphQLScalarType } from 'graphql';
import * as GraphQLJSON from 'graphql-type-json';

const JSONObject = GraphQLJSON.GraphQLJSONObject;

// Good explanation of the difference between
// parseValue(), serialize(), and parseLiteral() here:
// https://stackoverflow.com/questions/41510880/whats-the-difference-between-parsevalue-and-parseliteral-in-graphqlscalartype

const Date = new GraphQLScalarType({
  name: 'Date',
  description: 'Date scalar type',
  parseValue(value) {
    if (typeof value !== 'string') throw new Error(`Expected string, got ${typeof value}`);
    // Parse input when the type of input is JSON
    // e.g. input is passed into query as a JSON variable
    return DateTime.fromISO(value);
  },
  serialize(value) {
    if (!isDate(value)) throw new Error(`Expected string, got ${typeof value}`);
    // Prep return value to be sent to client
    return DateTime.fromJSDate(value).toISO();
  },
  parseLiteral(ast) {
    if (ast.kind !== 'StringValue') throw new Error(`Expected string, got ${ast.kind}`);
    // Parse input when the type of input is "inline" (AST)
    return DateTime.fromISO(ast.value);
  },
});

export default {
  JSONObject,
  Date,
};

function isDate(val: unknown): val is Date {
  return val instanceof global.Date;
}
