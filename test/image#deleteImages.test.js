import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import S3 from '@aws-sdk/client-s3';
import ImageModel from '../src/api/db/models/Image.js';
import ImageSchema from '../src/api/db/schemas/Image.js';
import ImageErrorSchema from '../src/api/db/schemas/ImageError.js';
import ImageAttemptSchema from '../src/api/db/schemas/ImageAttempt.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('Image: DeleteImages', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(S3.S3Client.prototype, 'send').callsFake((command) => {
      if (command instanceof S3.DeleteObjectCommand) {
        mocks.push(`S3::DeleteObjectCommand::${command.input.Bucket}/${command.input.Key}`);
      } else {
        t.fail();
      }
    });

    Sinon.stub(ImageSchema, 'findOne').callsFake((command) => {
      t.ok(command._id.startsWith('project:'));
      mocks.push(`Image::FindOne::${command._id}`);
      return { _id: command._id };
    });

    Sinon.stub(ImageSchema, 'deleteOne').callsFake((command) => {
      mocks.push(`Image::DeleteOne::${command._id}`);
      return true;
    });

    Sinon.stub(ImageAttemptSchema, 'deleteOne').callsFake((command) => {
      mocks.push(`ImageAttempt::DeleteOne::${command._id}`);
      return true;
    });

    Sinon.stub(ImageErrorSchema, 'aggregate').callsFake((command) => {
      mocks.push(`ImageError::Aggregate::${command[0].$match.image}`);
      return [];
    });

    Sinon.stub(ImageErrorSchema, 'deleteMany').callsFake((command) => {
      mocks.push(`ImageError::DeleteMany::${command.image}`);
      return [];
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

  t.deepEquals(mocks.sort(), [
    'Image::FindOne::project:123',
    'Image::FindOne::project:223',
    'Image::FindOne::project:323',
    'ImageError::Aggregate::project:123',
    'ImageError::Aggregate::project:223',
    'ImageError::Aggregate::project:323',
    'S3::DeleteObjectCommand::animl-images-serving-dev/medium/project:123-medium.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/original/project:123-original.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/small/project:123-small.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/medium/project:223-medium.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/original/project:223-original.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/small/project:223-small.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/medium/project:323-medium.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/original/project:323-original.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/small/project:323-small.jpg',
    'Image::DeleteOne::project:123',
    'Image::DeleteOne::project:223',
    'Image::DeleteOne::project:323',
    'ImageAttempt::DeleteOne::project:123',
    'ImageAttempt::DeleteOne::project:223',
    'ImageAttempt::DeleteOne::project:323',
    'ImageError::DeleteMany::project:123',
    'ImageError::DeleteMany::project:223',
    'ImageError::DeleteMany::project:323'
  ].sort());

  Sinon.restore();
  t.end();
});

tape('Image: DeleteImages - error', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(S3.S3Client.prototype, 'send').callsFake((command) => {
      if (command instanceof S3.DeleteObjectCommand) {
        mocks.push(`S3::DeleteObjectCommand::${command.input.Bucket}/${command.input.Key}`);
      } else {
        t.fail();
      }
    });

    Sinon.stub(ImageSchema, 'findOne').callsFake((command) => {
      t.ok(command._id.startsWith('project:'));
      mocks.push(`Image::FindOne::${command._id}`);
      return { _id: command._id };
    });

    Sinon.stub(ImageSchema, 'deleteOne').callsFake((command) => {
      mocks.push(`Image::DeleteOne::${command._id}`);
      return true;
    });

    Sinon.stub(ImageAttemptSchema, 'deleteOne').callsFake((command) => {
      mocks.push(`ImageAttempt::DeleteOne::${command._id}`);
      return true;
    });

    Sinon.stub(ImageErrorSchema, 'aggregate').callsFake((command) => {
      mocks.push(`ImageError::Aggregate::${command[0].$match.image}`);
      return [];
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

    t.equals(res.isOk, false);
    t.equals(res.errors.length, 1);
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks.sort(), [
    'Image::FindOne::project:123',
    'Image::FindOne::project:223',
    'Image::FindOne::project:323',
    'ImageError::Aggregate::project:123',
    'ImageError::Aggregate::project:223',
    'ImageError::Aggregate::project:323',
    'S3::DeleteObjectCommand::animl-images-serving-dev/medium/project:123-medium.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/original/project:123-original.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/small/project:123-small.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/medium/project:223-medium.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/original/project:223-original.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/small/project:223-small.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/medium/project:323-medium.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/original/project:323-original.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/small/project:323-small.jpg',
    'Image::DeleteOne::project:123',
    'Image::DeleteOne::project:223',
    'Image::DeleteOne::project:323',
    'ImageAttempt::DeleteOne::project:123',
    'ImageAttempt::DeleteOne::project:223',
    'ImageAttempt::DeleteOne::project:323',
    'ImageError::DeleteMany::project:123',
    'ImageError::DeleteMany::project:223',
    'ImageError::DeleteMany::project:323'
  ].sort());

  Sinon.restore();
  t.end();
});
