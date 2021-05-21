const {
  ApolloError,
  formatApolloErrors,
  toApolloError,
} = require('apollo-server-errors');
const { GraphQLError } = require('graphql/error/GraphQLError');

// Apollo errors docs: 
// https://www.apollographql.com/docs/apollo-server/data/errors/

class DuplicateError extends ApolloError {
  constructor(message) {
    super(message, 'DUPLICATE_IMAGE');
    Object.defineProperty(this, 'name', { value: 'DuplicateError' });
  }
};

// NOTE: The goal here is to coerce all Errors into ApolloErrors
// with proper error codes before they're returned to the client.
// This probably won't be necessary with the next update of graphql-yoga
// if they upgrade to apollo-server 2.0 under the hood

function formatError (err) {
  console.log('err before formatting: ', err);
 
  // if err is an instance of a GraphQLError, it is either:
  // (a) an ApolloError we intentionally threw somewhere in the code, or 
  // (b) a GraphQLError thrown by graphql-yoga in the parse or validation phase
  // we can use formatApolloErrors() to format either case. 
  // If the err is not a GraphQLError, that means something unexpected happened, 
  // but we can convert it to an ApolloError and give it the generic code: 
  // INTERNAL_SERVER_ERROR with toApolloError().

  const error = err instanceof GraphQLError 
    ? formatApolloErrors([err])[0]
    : toApolloError(err);

  if (
    error.extensions &&
      (error.message.startsWith(`Variable "`) ||
        error.message.startsWith(`Cannot query field`) ||
          error.extensions.code === "GRAPHQL_VALIDATION_FAILED")
    ) {
    error.extensions.code = "GRAPHQL_VALIDATION_FAILED";
  }

  console.log('error before sending to client: ', error);

  return error;
};

module.exports = {
  DuplicateError,
  formatError,
}