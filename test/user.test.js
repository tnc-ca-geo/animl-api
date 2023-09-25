import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import Cognito from '@aws-sdk/client-cognito-identity-provider';
import UserModel from '../src/api/db/models/User.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('User: List', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(Cognito.CognitoIdentityProviderClient.prototype, 'send').callsFake((command) => {
      if (command instanceof Cognito.ListUsersInGroupCommand) {
        mocks.push(`Cognito::ListUsersInGroup::${command.input.GroupName}`);
        if (command.input.GroupName.includes('manager')) return { Users: [{
            username: 'manager',
            UserCreateDate: '2022',
            UserLastModifiedDate: '2023',
            Enabled: true,
            Attributes: [{ Name: 'email', Value: 'manager@example.com' }],
            UserStatus: 'CONFIRMED'
        }] };
        if (command.input.GroupName.includes('observer')) return { Users: [{
            username: 'observer',
            UserCreateDate: '2022',
            UserLastModifiedDate: '2023',
            Enabled: true,
            Attributes: [{ Name: 'email', Value: 'observer@example.com' }],
            UserStatus: 'CONFIRMED'
        }] };
        if (command.input.GroupName.includes('member')) return { Users: [{
            username: 'member',
            UserCreateDate: '2022',
            UserLastModifiedDate: '2023',
            Enabled: true,
            Attributes: [{ Name: 'email', Value: 'member@example.com' }],
            UserStatus: 'CONFIRMED'
        }] };
      } else {
        t.fail();
      }
    });

    const userModel = new UserModel({ curr_project_roles: ['project_manager'] });

    const res = await userModel.listUsers({
      imageId: 'project:123'
    }, {
      user: {
        curr_project: 'project'
      }
    });

    t.deepEquals(res, {
      users:  [{
        username: 'manager',
        email: 'manager@example.com',
        created: '2022',
        updated: '2023',
        enabled: true,
        status: 'CONFIRMED'
      },{
        username: 'observer',
        email: 'observer@example.com',
        created: '2022',
        updated: '2023',
        enabled: true,
        status: 'CONFIRMED'
      },{
        username: 'member',
        email: 'member@example.com',
        created: '2022',
        updated: '2023',
        enabled: true,
        status: 'CONFIRMED'
      }]
    });
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, [
    'Cognito::ListUsersInGroup::animl/project/project_manager',
    'Cognito::ListUsersInGroup::animl/project/project_observer',
    'Cognito::ListUsersInGroup::animl/project/project_member',
  ]);

  Sinon.restore();
  t.end();
});
