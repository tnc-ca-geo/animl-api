import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import S3 from '@aws-sdk/client-s3';
import ImageModel from '../.build/api/db/models/Image.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';
import ImageErrorSchema from '../.build/api/db/schemas/ImageError.js';
import ImageAttemptSchema from '../.build/api/db/schemas/ImageAttempt.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('Image: DeleteImage', async (t) => {
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
      t.deepEquals(command, { _id: 'project:123', projectId: 'project' });
      mocks.push('Image::FindOne');
      return { _id: 'project:123' };
    });

    Sinon.stub(ImageSchema, 'deleteOne').callsFake((command) => {
      t.deepEquals(command, { _id: 'project:123' });
      mocks.push('Image::DeleteOne');
      return true;
    });

    Sinon.stub(ImageAttemptSchema, 'deleteOne').callsFake((command) => {
      t.deepEquals(command, { _id: 'project:123' });
      mocks.push('ImageAttempt::DeleteOne');
      return true;
    });

    Sinon.stub(ImageErrorSchema, 'aggregate').callsFake((command) => {
      t.deepEquals(command, [{ $match: { image: 'project:123' } }]);
      mocks.push('ImageError::Aggregate');
      return [];
    });

    Sinon.stub(ImageErrorSchema, 'deleteMany').callsFake((command) => {
      t.deepEquals(command, { image: 'project:123' });
      mocks.push('ImageError::DeleteMany');
      return [];
    });

    const imageModel = new ImageModel({ curr_project_roles: ['project_manager'] });

    const res = await imageModel.deleteImage({
      imageId: 'project:123'
    }, {
      user: {
        curr_project: 'project'
      }
    });

    t.deepEquals(res, { isOk: true });
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, [
    'Image::FindOne',
    'ImageError::Aggregate',
    'S3::DeleteObjectCommand::animl-images-serving-dev/medium/project:123-medium.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/original/project:123-original.jpg',
    'S3::DeleteObjectCommand::animl-images-serving-dev/small/project:123-small.jpg',
    'Image::DeleteOne',
    'ImageAttempt::DeleteOne',
    'ImageError::DeleteMany'
  ]);

  Sinon.restore();
  t.end();
});

tape('Image: DeleteImage - Failure', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(ImageSchema, 'findOne').callsFake((command) => {
      t.deepEquals(command, { _id: 'project:123', projectId: 'project' });
      mocks.push('Image::FindOne');
      return { _id: 'project:123' };
    });
    Sinon.stub(ImageErrorSchema, 'aggregate').callsFake((command) => {
      t.deepEquals(command, [{ $match: { image: 'project:123' } }]);
      mocks.push('ImageError::Aggregate');
      return [];
    });

    Sinon.stub(S3.S3Client.prototype, 'send').callsFake((command) => {
      if (command instanceof S3.DeleteObjectCommand) {
        return Promise.reject(new Error('Network Error'));
      } else {
        t.fail();
      }
    });

    const imageModel = new ImageModel({ curr_project_roles: ['project_manager'] });

    await imageModel.deleteImage({
      imageId: 'project:123'
    }, {
      user: {
        curr_project: 'project'
      }
    });

    t.fail();
  } catch (err) {
    t.ok(String(err).includes('Network Error'));
  }

  t.deepEquals(mocks, [
    'Image::FindOne',
    'ImageError::Aggregate'
  ]);

  Sinon.restore();
  t.end();
});
