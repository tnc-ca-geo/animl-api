import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import { ImageModel } from '../.build/api/db/models/Image.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';
import { SetTimestampOffsetByFilter } from '../.build/task/image.js';

tape('Image: SetTimestampOffsetByFilter - Success with single page', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const filters = { cameras: ['camera1'] };
    const offsetMs = 3600000;

    Sinon.stub(ImageModel, 'queryByFilter').callsFake((input, context) => {
      t.deepEquals(input.filters, filters);
      t.equal(input.limit, 500);
      t.equal(context.user.is_superuser, true);
      mocks.push('ImageModel::QueryByFilter');
      return {
        results: [
          { _id: 'project:img1' },
          { _id: 'project:img2' },
          { _id: 'project:img3' },
        ],
        hasNext: false,
      };
    });

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      t.equal(operations.length, 3, 'Should have 3 operations');
      mocks.push('Image::BulkWrite');
      return { modifiedCount: 3, matchedCount: 3 };
    });

    const task = {
      projectId: 'project',
      config: {
        filters,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetByFilter(task);

    t.deepEquals(res.filters, filters);
    t.equal(res.modifiedCount, 3, 'Should have modified 3 images');
    t.equal(res.errors.length, 0, 'Should have no errors');
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['ImageModel::QueryByFilter', 'Image::BulkWrite']);
  Sinon.restore();
  t.end();
});

tape('Image: SetTimestampOffsetByFilter - Success with multiple pages', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const filters = { deployments: ['deployment1'] };
    const offsetMs = -7200000;

    let queryCallCount = 0;
    Sinon.stub(ImageModel, 'queryByFilter').callsFake((input) => {
      queryCallCount++;
      mocks.push(`ImageModel::QueryByFilter:${queryCallCount}`);

      if (queryCallCount === 1) {
        return {
          results: Array.from({ length: 500 }, (_, i) => ({ _id: `project:img${i}` })),
          hasNext: true,
          next: 'cursor1',
        };
      } else if (queryCallCount === 2) {
        t.equal(input.next, 'cursor1', 'Should pass next cursor');
        return {
          results: Array.from({ length: 300 }, (_, i) => ({ _id: `project:img${i + 500}` })),
          hasNext: false,
        };
      }
    });

    let bulkWriteCallCount = 0;
    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      bulkWriteCallCount++;
      mocks.push(`Image::BulkWrite:${bulkWriteCallCount}`);
      return { modifiedCount: operations.length, matchedCount: operations.length };
    });

    const task = {
      projectId: 'project',
      config: {
        filters,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetByFilter(task);

    t.deepEquals(res.filters, filters);
    t.equal(res.modifiedCount, 800, 'Should have modified 800 images');
    t.equal(res.errors.length, 0, 'Should have no errors');
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, [
    'ImageModel::QueryByFilter:1',
    'Image::BulkWrite:1',
    'ImageModel::QueryByFilter:2',
    'Image::BulkWrite:2',
  ]);
  Sinon.restore();
  t.end();
});

tape('Image: SetTimestampOffsetByFilter - Partial modification', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const filters = { cameras: ['camera1'] };
    const offsetMs = 1800000;

    Sinon.stub(ImageModel, 'queryByFilter').callsFake(() => {
      mocks.push('ImageModel::QueryByFilter');
      return {
        results: [
          { _id: 'project:img1' },
          { _id: 'project:img2' },
          { _id: 'project:img3' },
        ],
        hasNext: false,
      };
    });

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake(() => {
      mocks.push('Image::BulkWrite');
      // Only 2 out of 3 were modified (one might have been deleted concurrently)
      return { modifiedCount: 2, matchedCount: 2 };
    });

    const task = {
      projectId: 'project',
      config: {
        filters,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetByFilter(task);

    t.deepEquals(res.filters, filters);
    t.equal(res.modifiedCount, 2, 'Should have modified 2 images');
    t.equal(res.errors.length, 1, 'Should have 1 error for failed updates');
    t.ok(res.errors[0].includes('Failed to update 1 images'));
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['ImageModel::QueryByFilter', 'Image::BulkWrite']);
  Sinon.restore();
  t.end();
});

tape('Image: SetTimestampOffsetByFilter - No matching images', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const filters = { cameras: ['nonexistent'] };
    const offsetMs = 3600000;

    Sinon.stub(ImageModel, 'queryByFilter').callsFake(() => {
      mocks.push('ImageModel::QueryByFilter');
      return {
        results: [],
        hasNext: false,
      };
    });

    const task = {
      projectId: 'project',
      config: {
        filters,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetByFilter(task);

    t.deepEquals(res.filters, filters);
    t.equal(res.modifiedCount, 0, 'Should have modified 0 images');
    t.equal(res.errors.length, 0, 'Should have no errors');
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['ImageModel::QueryByFilter']);
  Sinon.restore();
  t.end();
});
