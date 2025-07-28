import { GraphQLError } from 'graphql';

export default GraphQLError;

// Apollo errors docs:
// https://www.apollographql.com/docs/apollo-server/data/errors/

export class InternalServerError extends GraphQLError {
  constructor(message = 'InternalServerError', properties = {}) {
    console.error(new Error(message));
    super(message, {
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        ...properties,
      },
    });
  }
}

export class AuthenticationError extends GraphQLError {
  constructor(message = 'AuthenticationError', properties = {}) {
    super(message, {
      extensions: {
        code: 'AUTHENTICATION_ERROR',
        ...properties,
      },
    });
  }
}

export class ForbiddenError extends GraphQLError {
  constructor(message = 'ForbiddenError', properties = {}) {
    super(message, {
      extensions: {
        code: 'FORBIDDEN',
        ...properties,
      },
    });
  }
}

export class NotFoundError extends GraphQLError {
  constructor(message = 'NotFound', properties = {}) {
    super(message, {
      extensions: {
        code: 'NOT_FOUND',
        ...properties,
      },
    });
  }
}

export class DuplicateImageError extends GraphQLError {
  constructor(message = 'DuplicateImageError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DUPLICATE_IMAGE',
        ...properties,
      },
    });
  }
}

export class DuplicateLabelError extends GraphQLError {
  constructor(message = 'DuplicateLabelError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DUPLICATE_LABEL',
        ...properties,
      },
    });
  }
}

export class DBValidationError extends GraphQLError {
  constructor(message = 'DBValidationError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DB_VALIDATION_FAILED',
        ...properties,
      },
    });
  }
}

export class DeleteLabelError extends GraphQLError {
  constructor(message = 'DeleteLabelError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DELETE_LABEL_FAILED',
        ...properties,
      },
    });
  }
}

export class DeleteTagError extends GraphQLError {
  constructor(message = 'DeleteTagError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DELETE_TAG_FAILED',
        ...properties,
      },
    });
  }
}

export class ApplyTagError extends GraphQLError {
  constructor(message = 'ApplyTagError', properties = {}) {
    super(message, {
      extensions: {
        code: 'APPLY_TAG_FAILED',
        ...properties,
      },
    });
  }
}

export class CameraRegistrationError extends GraphQLError {
  constructor(message = 'CameraRegistrationError', properties = {}) {
    super(message, {
      extensions: {
        code: 'CAMERA_REGISTRATION_ERROR',
        ...properties,
      },
    });
  }
}

export class DeleteCameraError extends GraphQLError {
  constructor(message = 'DeleteCameraError', properties = {}) {
    super(message, {
      extensions: {
        code: 'DELETE_CAMERA_ERROR',
        ...properties,
      },
    });
  }
}
