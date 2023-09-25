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
   * List Users part of a given group
   */
  static async list(input, context) {
    const cognito = new Cognito.CognitoIdentityProviderClient();

    const query = context.user['curr_project']

    try {
      const users = (await Promise.all(['manager', 'observer', 'member'].map(async function(role) {
        const list = [];
        let res = {};
        do {
            res = cognito.send(new Cognito.ListUsersInGroupCommand({
              UserPoolId: context.config['/APPLICATION/COGNITO/USERPOOLID'],
              GroupName: `animl/${context.user['curr_project']}/project_${role}`
            }));
            list.push(...res.Users);
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
            username: user.username,
            email: meta.email,
            created: user.UserCreateDate,
            updated: user.UserLastModifiedDate,
            enabled: user.Enabled,
            status: user.UserStatus,
        }
      });

      return {
        users
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

  async listUsers(input, context) {
    if (!hasRole(this.user, MANAGE_USERS_ROLES)) throw new ForbiddenError;
    return await UserModel.list(input, context);
  }
}
