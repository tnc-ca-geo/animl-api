import Sinon from 'sinon';

import SM  from '@aws-sdk/client-secrets-manager';
import SSM from '@aws-sdk/client-ssm';
import Mongoose from 'mongoose';

export class MockMongoose {
  constructor() {
    this.responses = [];
  }
}

export default function(t) {
  Sinon.stub(SSM.SSMClient.prototype, 'send').callsFake((command) => {
    if (command instanceof SSM.GetParametersCommand) {
      const Parameters = command.input.Names.map((name) => {
        return {
          Name: name,
          Value: '123'
        };
      });

      Parameters.push({
        Name: '/EXPORTS/EXPORTED_DATA_BUCKET',
        Value: 'example-bucket'
      });

      return Promise.resolve({ Parameters, InvalidParameters: [] });
    } else {
      t.fail();
    }
  });

  Sinon.stub(SM.SecretsManagerClient.prototype, 'send').callsFake((command) => {
    if (command instanceof SM.GetSecretValueCommand) {
      return Promise.resolve({
        SecretString: '{"apikey": "api-key"}'
      });
    } else {
      t.fail();
    }
  });

  const m = new MockMongoose();
  Sinon.stub(Mongoose, 'connect').callsFake(() => {
    return Promise.resolve(m);
  });
}
