import {
  ApolloError,
  formatApolloErrors,
  toApolloError
} from 'apollo-server-errors';
import { GraphQLError } from 'graphql/error/GraphQLError.js';

// Apollo errors docs:
// https://www.apollographql.com/docs/apollo-server/data/errors/

// good blog post:
// https://tomek.fojtuch.com/blog/error-handling-with-apollo-server/

class DuplicateError extends ApolloError {
  constructor(message) {
    super(message, 'DUPLICATE_IMAGE');
    Object.defineProperty(this, 'name', { value: 'DuplicateError' });
  }
}

class DuplicateLabelError extends ApolloError {
  constructor(message) {
    super(message, 'DUPLICATE_LABEL');
    Object.defineProperty(this, 'name', { value: 'DuplicateLabelError' });
  }
}

class DBValidationError extends ApolloError {
  constructor(message) {
    super(message, 'DB_VALIDATION_FAILED');
    Object.defineProperty(this, 'name', { value: 'DBValidationError' });
  }
}

// NOTE: use "properties" in constructor to return additional
// custom error details in response
class CameraRegistrationError extends ApolloError {
  constructor(message, properties) {
    super(message, 'CAMERA_REGISTRATION_ERROR', properties);
    Object.defineProperty(this, 'name', { value: 'CameraRegistrationError' });
  }
}

function formatError (err) {

  /*
   * NOTE: The goal here is to coerce all Errors into ApolloErrors
   * with proper error codes before they're returned to the client.
   * This probably won't be necessary with the next update of graphql-yoga
   * if they upgrade to apollo-server 2.0 under the hood.
   *
   * If err is an instance of a GraphQLError, it is either:
   * (a) an ApolloError we intentionally threw somewhere in the code, or
   * (b) a GraphQLError thrown by graphql-yoga in the parse or validation phase
   * we can use formatApolloErrors() to format either case.
   * If the err is not a GraphQLError, that means something unexpected happened,
   * but we can convert it to an ApolloError and give it the generic code:
   * INTERNAL_SERVER_ERROR with toApolloError().
   */

  const error = (err instanceof GraphQLError)
    ? formatApolloErrors([err])[0]
    : toApolloError(err);

  if (
    error.extensions &&
      (error.message.startsWith('Variable "') ||
        error.message.startsWith('Cannot query field') ||
          error.extensions.code === 'GRAPHQL_VALIDATION_FAILED')
  ) {
    error.extensions.code = 'GRAPHQL_VALIDATION_FAILED';
  }

  // TODO: mask unexpected errors (upgrading to graphql-yoga 2.x would do
  // this automatically)
  // https://www.graphql-yoga.com/docs/features/error-masking
  // https://www.apollographql.com/docs/apollo-server/data/errors/#omitting-or-including-stacktrace

  return error;
}

export {
  DuplicateError,
  DuplicateLabelError,
  DBValidationError,
  CameraRegistrationError,
  formatError
};
