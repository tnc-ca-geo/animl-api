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

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      t.equals(operations.length, 1);
      t.deepEquals(operations[0].updateOne.filter, {
        _id: 'project:123',
      });
      t.deepEquals(operations[0].updateOne.update, { $set: { dateTimeOffsetMs: 3600000 } });
      mocks.push('Image::BulkWrite');
      return { modifiedCount: 1, acknowledged: true };
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

  t.deepEquals(mocks, ['Image::BulkWrite']);

  Sinon.restore();
  t.end();
});

tape('Image: setTimestampOffset - Image not found', async (t) => {
  const mocks = [];

  try {
    MockConfig(t);

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      t.equals(operations.length, 1);
      mocks.push('Image::BulkWrite');
      return { modifiedCount: 0, acknowledged: true };
    });

    const imageModel = new ImageModel({ curr_project_roles: ['project_manager'] });

    const res = await imageModel.setTimestampOffset(
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

    t.deepEquals(res, { isOk: false });
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['Image::BulkWrite']);

  Sinon.restore();
  t.end();
});
