import Cognito from '@aws-sdk/client-cognito-identity-provider';
import GraphQLError, { InternalServerError } from '../../errors.js';
import { MANAGE_USERS_ROLES } from '../../auth/roles.js';
import { BaseAuthedModel, MethodParams, roleCheck } from './utils.js';
import { Context } from '../../handler.js';
import * as gql from '../../../@types/graphql.js';

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
  static async createGroups(
    input: { name: string },
    context: Pick<Context, 'config'>,
  ): Promise<gql.StandardPayload> {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {
      for (const role of ['manager', 'observer', 'member']) {
        await cognito.send(
          new Cognito.CreateGroupCommand({
            GroupName: `animl/${input.name}/project_${role}`,
            UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
          }),
        );
      }

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * Create a new User in the cognito pool and assign it initial roles
   * @param {object} input
   * @param {string} input.username Email/Username to create
   * @param {string[]} input.roles List of roles the user should have within the project
   * @param {object} context
   */
  static async create(
    input: gql.CreateUserInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<gql.StandardPayload> {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {
      await cognito.send(
        new Cognito.AdminGetUserCommand({
          Username: input.username,
          UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
        }),
      );

      await this.update(
        {
          username: input.username,
          roles: input.roles,
        },
        context,
      );

      return { isOk: true };
    } catch (err) {
      if (err instanceof Cognito.UserNotFoundException) {
        try {
          await cognito.send(
            new Cognito.AdminCreateUserCommand({
              Username: input.username,
              DesiredDeliveryMediums: ['EMAIL'],
              // UserStatus: 'CONFIRMED',
              UserAttributes: [
                {
                  Name: 'email',
                  Value: input.username,
                },
                {
                  Name: 'email_verified',
                  Value: 'true',
                },
              ],
              UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
            }),
          );

          await this.update(
            {
              username: input.username,
              roles: input.roles,
            },
            context,
          );

          return { isOk: true };
        } catch (err) {
          if (err instanceof GraphQLError) throw err;
          throw new InternalServerError(err as string);
        }
      } else {
        if (err instanceof GraphQLError) throw err;
        throw new InternalServerError(err as string);
      }
    }
  }

  /**
   * Update a User role(s) within a given project
   * @param {object} input
   * @param {string} input.username Username to update
   * @param {string[]} input.roles List of roles the user should have within the project
   * @param {object} context
   */
  static async update(
    input: gql.UpdateUserInput,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<gql.StandardPayload> {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {
      const roles = (
        await cognito.send(
          new Cognito.AdminListGroupsForUserCommand({
            Username: input.username,
            UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
          }),
        )
      )
        .Groups!.filter((group) => {
          const parsed = group.GroupName!.split('/');
          return context.user['curr_project'] === parsed.slice(1, parsed.length - 1).join('/');
        })
        .map((group) => group.GroupName!.split('/').pop()!.split('_')[1]);

      for (const role of ['manager', 'observer', 'member'] as gql.UserRole[]) {
        if (input.roles.includes(role) && roles.includes(role)) {
          // If the Role is already present, ignore it and continue
          continue;
        } else if (input.roles.includes(role) && !roles.includes(role)) {
          // Role is desired but not currently present, add user to new group
          await cognito.send(
            new Cognito.AdminAddUserToGroupCommand({
              Username: input.username,
              UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
              GroupName: `animl/${context.user['curr_project']}/project_${role}`,
            }),
          );
        } else if (!input.roles.includes(role) && roles.includes(role)) {
          // Role present but not desired, remove user from group
          await cognito.send(
            new Cognito.AdminRemoveUserFromGroupCommand({
              Username: input.username,
              UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
              GroupName: `animl/${context.user['curr_project']}/project_${role}`,
            }),
          );
        }
      }

      return { isOk: true };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }

  /**
   * List Users part of a given group
   *
   * @param {object} input
   * @param {string} input.filter Filter usernames by string
   * @param {object} context
   */
  static async list(
    input: Maybe<gql.QueryUsersInput> | undefined,
    context: Pick<Context, 'user' | 'config'>,
  ): Promise<{ users: CognitoUser[] }> {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    try {
      const users = (
        await Promise.all(
          (['manager', 'observer', 'member'] as gql.UserRole[]).map(async (role) => {
            const usersList = [];
            let res: Cognito.ListUsersInGroupCommandOutput;
            do {
              res = await cognito.send(
                new Cognito.ListUsersInGroupCommand({
                  Limit: 60,
                  UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
                  GroupName: `animl/${context.user['curr_project']}/project_${role}`,
                }),
              );

              usersList.push(...(res.Users || []));
            } while (res.NextToken);

            return usersList.map((user) => ({ ...user, role }));
          }),
        )
      )
        .reduce((acc, cur) => acc.concat(cur), [])
        .map((user) => ({
          role: user.role,
          username: user.Username!,
          email: user.Attributes?.find(({ Name }) => Name === 'email')?.Value,
          created: user.UserCreateDate,
          updated: user.UserLastModifiedDate,
          enabled: user.Enabled,
          status: user.UserStatus,
        }))
        .filter((user) => !input?.filter || user.username.includes(input.filter));

      const roles = new Map<string, CognitoUser>();
      for (const { role, username, ...user } of users) {
        if (roles.has(username)) {
          roles.get(username)!.roles.push(role);
        } else {
          roles.set(username, { ...user, username, roles: [role] });
        }
      }

      return {
        users: Array.from(roles.values()),
      };
    } catch (err) {
      if (err instanceof GraphQLError) throw err;
      throw new InternalServerError(err as string);
    }
  }
}

export default class AuthedUserModel extends BaseAuthedModel {
  @roleCheck(MANAGE_USERS_ROLES)
  createGroups(...args: MethodParams<typeof UserModel.createGroups>) {
    return UserModel.createGroups(...args);
  }

  @roleCheck(MANAGE_USERS_ROLES)
  createUser(...args: MethodParams<typeof UserModel.create>) {
    return UserModel.create(...args);
  }

  @roleCheck(MANAGE_USERS_ROLES)
  listUsers(...args: MethodParams<typeof UserModel.list>) {
    return UserModel.list(...args);
  }

  @roleCheck(MANAGE_USERS_ROLES)
  updateUser(...args: MethodParams<typeof UserModel.update>) {
    return UserModel.update(...args);
  }
}

interface CognitoUser {
  roles: gql.UserRole[];
  username: string;
  email?: string;
  created?: Date;
  updated?: Date;
  enabled?: boolean;
  status?: Cognito.UserStatusType;
}
