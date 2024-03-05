import { GraphQLError } from 'graphql/error/GraphQLError.js';

export default GraphQLError;

// Apollo errors docs:
// https://www.apollographql.com/docs/apollo-server/data/errors/

export class InternalServerError extends GraphQLError {
  constructor(message = 'InternalServerError', properties = {}) {
    console.error(new Error(message));
    super(message, {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        ...properties
      }
    });
  }
}

export class AuthenticationError extends GraphQLError {
  constructor(message = 'AuthenticationError', properties = {}) {
    super(message, {
      extensions: {
        code: 'AUTHENTICATION_ERROR',
        ...properties
      }
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'ForbiddenError', properties = {}) {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        ...properties
      }
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message = 'NotFound', properties = {}) {
    super(message, {
      extensions: {
        code: 'NOT_FOUND',
        ...properties
      }
    });
  }
}

export class DuplicateImageError extends GraphQLError {
  constructor(message = 'DuplicateImageError', properties = {}) {
    super(message,  {
      extensions: {
        code: 'DUPLICATE_IMAGE',
        ...properties
      }
    });
  }
}

export class DuplicateLabelError extends GraphQLError {
  constructor(message = 'DuplicateLabelError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DUPLICATE_LABEL',
        ...properties
      }
    });
  }
}

export class DBValidationError extends GraphQLError {
  constructor(message = 'DBValidationError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DB_VALIDATION_FAILED',
        ...properties
      }
    });
  }
}

export class DeleteLabelError extends GraphQLError {
  constructor(message = 'DeleteLabelError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DELETE_LABEL_FAILED',
        ...properties
      }
    });
  }
}

export class CameraRegistrationError extends GraphQLError {
  constructor(message = 'CameraRegistrationError', properties = {}) {
    super(message, {
      extensions: {
        code: 'CAMERA_REGISTRATION_ERROR',
        ...properties
      }
    });
  }
}

export function formatError(err) {
  /*
     * NOTE: The goal here is to coerce all Errors into GraphQLErrors
     * with proper error codes before they're returned to the client.
     *
     * If err is an instance of a GraphQLError, it is likely a GraphQLError
     * thrown in the parse or validation phase or one intentionally thrown
     *
     * If the err is not a GraphQLError, that means something unexpected happened,
     * but we can convert it to an GraphQLError and give it the generic code INTERNAL_SERVER_ERROR
     */
  if (err instanceof GraphQLError) {
    return err;
  } else {
    return new InternalServerError(err instanceof Error ? err.message : String(err));
  }
}

