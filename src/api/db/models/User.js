import Cognito from '@aws-sdk/client-cognito-identity-provider';
import { ApolloError, ForbiddenError } from 'apollo-server-errors';
import { MANAGE_USERS_ROLES } from '../../auth/roles.js';
import { hasRole } from './utils.js';

/**
 * Users are managed in AWS Cognito but as the APIs are designed to be similiar
 * to those of DB objects, the model is defined here
 */
export class UserModel {
  /**
   * Create Cognito groups, used when creating a new project
   * @param {object} input
   * @param {string} input.name Project Name
   * @param {object} context
   */
  static async createGroups(input, context) {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {

      for (const role of ['manager', 'observer', 'member']) {
        await cognito.send(new Cognito.CreateGroupCommand({
          GroupName: `animl/${input.name}/project_${role}`,
          UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID']
        }));
      }

      return { message: 'Groups Created' };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  /**
   * Create a new User in the cognito pool and assign it initial roles
   * @param {object} input
   * @param {string} input.username Email/Username to create
   * @param {string[]} input.roles List of roles the user should have within the project
   * @param {object} context
   */
  static async create(input, context) {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {
      await cognito.send(new Cognito.AdminCreateUserCommand({
        Username: input.username,
        DesiredDeliberyMediums: ['EMAIL'],
        UserStatus: 'CONFIRMED',
        UserAttributes: [{
          Name: 'email',
          Value: input.username
        }],
        UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID']
      }));

      await cognito.send(new Cognito.AdminConfirmSignUpCommand({
        Username: input.username,
        UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID']
      }));

      await this.update({
        username: input.username,
        roles: input.roles
      }, context);

      return { message: 'User Created' };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }

  /**
   * Update a User role(s) within a given project
   * @param {object} input
   * @param {string} input.username Username to update
   * @param {string[]} input.roles List of roles the user should have within the project
   * @param {object} context
   */
  static async update(input, context) {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {
      const roles = (await cognito.send(new Cognito.AdminListGroupsForUserCommand({
        Username: input.username,
        UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID']
      }))).Groups.filter((group) => {
        const parsed = group.GroupName.split('/');
        return context.user['curr_project'] === parsed.slice(1, parsed.length - 1).join('/');
      }).map((group) => {
        return group.GroupName.split('/').pop().split('_')[1];
      });

      for (const role of ['manager', 'observer', 'member']) {
        if (input.roles.includes(role) && roles.includes(role)) {
          // If the Role is already present, ignore it and continue
          continue;
        } else if (input.roles.includes(role) && !roles.includes(role)) {
          // Role is desired but not currently present, add user to new group
          await cognito.send(new Cognito.AdminAddUserToGroupCommand({
            Username: input.username,
            UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
            GroupName: `animl/${context.user['curr_project']}/project_${role}`
          }));
        } else if (!input.roles.includes(role) && roles.includes(role)) {
          // Role present but not desired, remove user from group
          await cognito.send(new Cognito.AdminRemoveUserFromGroupCommand({
            Username: input.username,
            UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
            GroupName: `animl/${context.user['curr_project']}/project_${role}`
          }));
        }
      }

      return { message: 'User Updated' };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }


  /**
   * List Users part of a given group
   *
   * @param {object} input
   * @param {string} input.filter Filter usernames by string
   * @param {object} context
   */
  static async list(input, context) {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {
      const users = (await Promise.all(['manager', 'observer', 'member'].map(async (role) => {
        const list = [];
        let res = {};
        do {
          res = await cognito.send(new Cognito.ListUsersInGroupCommand({
            UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
            GroupName: `animl/${context.user['curr_project']}/project_${role}`
          }));

          list.push(...(res.Users || []));
        } while (res.NextToken);

        return list.map((user) => {
          user.role = role;
          return user;
        });
      }))).reduce((acc, cur) => {
        acc.push(...cur);
        return acc;
      }, []).map((user) => {
        const meta = user.Attributes.reduce((acc, cur) => {
          acc[cur.Name] = cur.Value;
          return acc;
        }, {});

        return {
          role: user.role,
          username: user.Username,
          email: meta.email,
          created: user.UserCreateDate,
          updated: user.UserLastModifiedDate,
          enabled: user.Enabled,
          status: user.UserStatus
        };
      }).filter((user) => {
        let passes = true;
        if (input.filter && !user.username.includes(input.filter)) passes = false;
        return passes;
      });

      const roles = new Map();
      for (const user of users) {
        if (roles.has(user.username)) {
          roles.get(user.username).roles.push(user.role);
        } else {
          user.roles = [user.role];
          delete user.role;
          roles.set(user.username, user);
        }
      }

      return {
        users: Array.from(roles.values())
      };
    } catch (err) {
      // if error is uncontrolled, throw new ApolloError
      if (err instanceof ApolloError) throw err;
      throw new ApolloError(err);
    }
  }
}

export default class AuthedUserModel {
  constructor(user) {
    this.user = user;
  }

  async createUser(input, context) {
    if (!hasRole(this.user, MANAGE_USERS_ROLES)) throw new ForbiddenError;
    return await UserModel.create(input, context);
  }

  async listUsers(input, context) {
    if (!hasRole(this.user, MANAGE_USERS_ROLES)) throw new ForbiddenError;
    return await UserModel.list(input, context);
  }

  async updateUser(input, context) {
    if (!hasRole(this.user, MANAGE_USERS_ROLES)) throw new ForbiddenError;

    return await UserModel.update(input, context);
  }
}
