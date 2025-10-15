import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import ImageModel from '../.build/api/db/models/Image.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';

tape('Image: setTimestampOffset - Success', async (t) => {
  const mocks = [];

  try {
    Sinon.restore(); // FIXME: There are mocks leaking from other tests
    MockConfig(t);

    Sinon.stub(ImageSchema, 'findOne').callsFake((command) => {
      t.deepEquals(command, { _id: 'project:123', projectId: 'project' });
      mocks.push('Image::FindOne');
      return { _id: 'project:123', projectId: 'project' };
    });

    Sinon.stub(ImageSchema, 'updateOne').callsFake((filter, update) => {
      t.deepEquals(filter, { _id: 'project:123' });
      t.deepEquals(update, { $set: { dateTimeOffsetMs: 3600000 } });
      mocks.push('Image::UpdateOne');
      return { acknowledged: true };
    });

    const imageModel = new ImageModel({ curr_project_roles: ['project_manager'] });

    const res = await imageModel.setTimestampOffset(
      {
        imageId: 'project:123',
        offsetMs: 3600000,
      },
      {
        user: {
          curr_project: 'project',
        },
      },
    );

    t.deepEquals(res, { isOk: true });
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['Image::FindOne', 'Image::UpdateOne']);

  Sinon.restore();
  t.end();
});

tape('Image: setTimestampOffset - Image not found', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(ImageSchema, 'findOne').callsFake((command) => {
      t.deepEquals(command, { _id: 'project:999', projectId: 'project' });
      mocks.push('Image::FindOne');
      return null;
    });

    const imageModel = new ImageModel({ curr_project_roles: ['project_manager'] });

    await imageModel.setTimestampOffset(
      {
        imageId: 'project:999',
        offsetMs: 3600000,
      },
      {
        user: {
          curr_project: 'project',
        },
      },
    );

    t.fail('Should have thrown an error');
  } catch (err) {
    t.ok(String(err).includes('Image not found'));
  }

  t.deepEquals(mocks, ['Image::FindOne']);

  Sinon.restore();
  t.end();
});
