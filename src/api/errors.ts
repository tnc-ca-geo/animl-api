import { GraphQLError } from 'graphql';

export default GraphQLError;

// Apollo errors docs:
// https://www.apollographql.com/docs/apollo-server/data/errors/

export class InternalServerError extends GraphQLError {
  constructor(message: string = 'InternalServerError', properties: Record<string, string> = {}) {
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
  constructor(message: string = 'AuthenticationError', properties: Record<string, string> = {}) {
    super(message, {
      extensions: {
        code: 'AUTHENTICATION_ERROR',
        ...properties
      }
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message: string = 'ForbiddenError', properties: Record<string, string> = {}) {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        ...properties
      }
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message: string = 'NotFound', properties: Record<string, string> = {}) {
    super(message, {
      extensions: {
        code: 'NOT_FOUND',
        ...properties
      }
    });
  }
}

export class DuplicateImageError extends GraphQLError {
  constructor(message: string = 'DuplicateImageError', properties: Record<string, string> = {}) {
    super(message,  {
      extensions: {
        code: 'DUPLICATE_IMAGE',
        ...properties
      }
    });
  }
}

export class DuplicateLabelError extends GraphQLError {
  constructor(message: string = 'DuplicateLabelError', properties: Record<string, string> = {}) {
    super(message, {
      extensions: {
        code: 'DUPLICATE_LABEL',
        ...properties
      }
    });
  }
}

export class DBValidationError extends GraphQLError {
  constructor(message: string = 'DBValidationError', properties: Record<string, string> = {}) {
    super(message, {
      extensions: {
        code: 'DB_VALIDATION_FAILED',
        ...properties
      }
    });
  }
}

export class DeleteLabelError extends GraphQLError {
  constructor(message: string = 'DeleteLabelError', properties: Record<string, string> = {}) {
    super(message, {
      extensions: {
        code: 'DELETE_LABEL_FAILED',
        ...properties
      }
    });
  }
}

export class CameraRegistrationError extends GraphQLError {
  constructor(message: string = 'CameraRegistrationError', properties: Record<string, string> = {}) {
    super(message, {
      extensions: {
        code: 'CAMERA_REGISTRATION_ERROR',
        ...properties
      }
    });
  }
}

