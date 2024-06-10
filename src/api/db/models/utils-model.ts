import { User } from '../../auth/authorization.js';
import { AuthenticationError, ForbiddenError } from '../../errors.js';
import { hasRole } from './utils.js';

/**
 * Decorator to check if user has role before calling underlying method
 * @param roles
 * @returns
 */
export function roleCheck(roles: string[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      if (!hasRole((this as BaseAuthedModel).user, roles)) {
        throw new ForbiddenError();
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

export class BaseAuthedModel {
  user: User;
  constructor(user: User | null) {
    if (!user) throw new AuthenticationError('Authentication failed');
    this.user = user;
  }
}

export type MethodParams<T> = T extends (...args: infer P) => any ? P : never;
