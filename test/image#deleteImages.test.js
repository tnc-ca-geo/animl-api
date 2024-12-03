import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import S3 from '@aws-sdk/client-s3';
import ImageModel from '../.build/api/db/models/Image.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';
import ImageErrorSchema from '../.build/api/db/schemas/ImageError.js';
import ImageAttemptSchema from '../.build/api/db/schemas/ImageAttempt.js';
import mongoose from 'mongoose';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('Image: DeleteImages', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(ImageSchema, 'find').callsFake((command) => {
      t.deepEquals(command, { _id: { $in: ['project:123', 'project:223', 'project:323'] } });
      mocks.push(`Image::find::${command._id.toString()}`);
      const res = command._id.$in.map((id) => ({ _id: id }));
      return res;
    });

    Sinon.stub(mongoose, 'startSession').callsFake(() => {
      mocks.push('mongoose::startSession');
      return {
        startTransaction: () => { },
        commitTransaction: () => { },
        abortTransaction: () => { },
        endSession: () => { }
      };
    });

    Sinon.stub(ImageSchema, 'deleteMany').callsFake((command) => {
      t.deepEquals(command, {
        _id: { $in: ['project:123', 'project:223', 'project:323'] },
        projectId: 'project',
      });
      mocks.push(`Image::DeleteMany::${command._id.toString()}`);
      return { acknowledged: true, deletedCount: 3 };
    });

    Sinon.stub(ImageAttemptSchema, 'deleteMany').callsFake((command) => {
      t.deepEquals(command, {
        _id: { $in: ['project:123', 'project:223', 'project:323'] },
        projectId: 'project',
      });
      mocks.push(`ImageAttempt::DeleteMany::${command._id.toString()}`);
      return { acknowledged: true, deletedCount: 3 };
    });

    Sinon.stub(ImageErrorSchema, 'deleteMany').callsFake((command) => {
      t.deepEquals(command, {
        image: { $in: ['project:123', 'project:223', 'project:323'] },
      });
      mocks.push(`ImageError::DeleteMany::${command.image.toString()}`);
      return { acknowledged: true, deletedCount: 3 };
    });

    Sinon.stub(S3.S3Client.prototype, 'send').callsFake((command) => {
      if (command instanceof S3.DeleteObjectsCommand) {
        mocks.push(`S3::DeleteObjectsCommand::${command.input.Bucket}`);
      } else {
        t.fail();
      }
      return { Deleted: [], Errors: [] };
    });

    const imageModel = new ImageModel({ curr_project_roles: ['project_manager'] });

    const res = await imageModel.deleteImages({
      imageIds: [
        'project:123',
        'project:223',
        'project:323'
      ]
    }, {
      user: {
        curr_project: 'project'
      }
    });

    t.deepEquals(res, {
      isOk: true,
      errors: []
    });
  } catch (err) {
    t.error(err);
  }
  console.log(mocks);
  t.deepEquals(mocks.sort(), [
    'Image::Find::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
    'mongoose::startSession',
    'Image::DeleteMany::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
    'ImageAttempt::DeleteMany::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
    'ImageError::DeleteMany::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
    'S3::DeleteObjectCommand::animl-images-serving-dev',
  ].sort());

  Sinon.restore();
  t.end();
});

tape('Image: DeleteImages - error', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(ImageSchema, 'find').callsFake((command) => {
      t.deepEquals(command, { _id: { $in: ['project:123', 'project:223', 'project:323'] } });
      mocks.push(`Image::find::${command._id.toString()}`);
      const res = command._id.$in.map((id) => ({ _id: id }));
      return res;
    });

    Sinon.stub(mongoose, 'startSession').callsFake(() => {
      mocks.push('mongoose::startSession');
      return {
        startTransaction: () => { },
        commitTransaction: () => { },
        abortTransaction: () => { },
        endSession: () => { }
      };
    });

    Sinon.stub(ImageSchema, 'deleteMany').callsFake((command) => {
      t.deepEquals(command, {
        _id: { $in: ['project:123', 'project:223', 'project:323'] },
        projectId: 'project',
      });
      mocks.push(`Image::DeleteMany::${command._id.toString()}`);
      return { acknowledged: true, deletedCount: 3 };
    });

    Sinon.stub(ImageAttemptSchema, 'deleteMany').callsFake((command) => {
      t.deepEquals(command, {
        _id: { $in: ['project:123', 'project:223', 'project:323'] },
        projectId: 'project',
      });
      mocks.push(`ImageAttempt::DeleteMany::${command._id.toString()}`);
      return { acknowledged: true, deletedCount: 3 };
    });

    Sinon.stub(ImageErrorSchema, 'deleteMany').callsFake((command) => {
      mocks.push(`ImageError::DeleteMany::${command.image}`);
      if (command.image === 'project:323') {
        return Promise.reject(new Error('Network Error'));
      } else {
        return [];
      }
    });

    const imageModel = new ImageModel({ curr_project_roles: ['project_manager'] });

    const res = await imageModel.deleteImages({
      imageIds: [
        'project:123',
        'project:223',
        'project:323'
      ]
    }, {
      user: {
        curr_project: 'project'
      }
    });
    console.log(res);
    t.equals(res.isOk, false);
    t.equals(res.errors.length, 1);
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks.sort(), [
    'Image::Find::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
    'mongoose::startSession',
    'Image::DeleteMany::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
    'ImageAttempt::DeleteMany::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
    'ImageError::DeleteMany::{ \'$in\': [ \'project: 123\', \'project: 223\', \'project: 323\' ] }',
  ].sort());

  Sinon.restore();
  t.end();
});
