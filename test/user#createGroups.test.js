import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import Cognito from '@aws-sdk/client-cognito-identity-provider';
import UserModel from '../.build/api/db/models/User.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('User: CreateGroups', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(Cognito.CognitoIdentityProviderClient.prototype, 'send').callsFake((command) => {
      if (command instanceof Cognito.CreateGroupCommand) {
        mocks.push(`Cognito::CreateGroupCommand::${command.input.GroupName}`);
        return Promise.resolve();
      } else {
        t.fail();
      }
    });

    const userModel = new UserModel({ curr_project_roles: ['project_manager'] });

    const res = await userModel.createGroups({
      name: 'i-am-project'
    }, {
      user: {
        curr_project: 'project'
      },
      config: {
        '/APPLICATION/COGNITO/USERPOOLID': 'example-pool'
      }
    });

    t.deepEquals(res, { isOk: true });
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, [
    'Cognito::CreateGroupCommand::animl/i-am-project/project_manager',
    'Cognito::CreateGroupCommand::animl/i-am-project/project_observer',
    'Cognito::CreateGroupCommand::animl/i-am-project/project_member'
  ]);

  Sinon.restore();
  t.end();
});
