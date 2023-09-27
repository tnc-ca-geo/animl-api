import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import Cognito from '@aws-sdk/client-cognito-identity-provider';
import UserModel from '../src/api/db/models/User.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('User: Update', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(Cognito.CognitoIdentityProviderClient.prototype, 'send').callsFake((command) => {
      if (command instanceof Cognito.AdminListGroupsForUserCommand) {
        mocks.push(`Cognito::AdminListGroupsForUser::${command.input.Username}`);

        return {
          Groups: [{
            GroupName: 'animl/project/project_observer'
          },{
            GroupName: 'animl/unrelated-project/project_observer'
          },{
            GroupName: 'animl/project/with/slash/project_observer'
          }]
        };
      } else {
        t.fail();
      }
    });

    const userModel = new UserModel({ curr_project_roles: ['project_manager'] });

    const res = await userModel.updateUser({
      username: 'test@example.com',
      roles: ['member', 'manager']
    }, {
      user: {
        curr_project: 'project'
      },
      config: {
        '/APPLICATION/COGNITO/USERPOOLID': 'example-pool'
      }
    });

    t.deepEquals(res, {
      message: 'User Updated'
    });
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, [
    'Cognito::AdminListGroupsForUser::test@example.com'
  ]);

  Sinon.restore();
  t.end();
});
