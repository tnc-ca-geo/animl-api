import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';
import { SetTimestampOffsetBatch } from '../.build/task/image.js';

tape('Image: SetTimestampOffsetBatch - Success with single batch', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const imageIds = ['project:img1', 'project:img2', 'project:img3'];
    const offsetMs = 3600000;

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      t.equal(operations.length, 3, 'Should have 3 operations');
      t.deepEquals(operations[0], {
        updateOne: {
          filter: { _id: 'project:img1' },
          update: { $set: { dateTimeOffsetMs: offsetMs } },
        },
      });
      mocks.push('Image::BulkWrite');
      return { modifiedCount: 3, matchedCount: 3 };
    });

    const task = {
      projectId: 'project',
      config: {
        imageIds,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetBatch(task);

    t.deepEquals(res.imageIds, imageIds);
    t.equal(res.modifiedCount, 3, 'Should have modified 3 images');
    t.equal(res.errors.length, 0, 'Should have no errors');
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['Image::BulkWrite']);
  Sinon.restore();
  t.end();
});

tape('Image: SetTimestampOffsetBatch - Success with multiple batches', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    // Create 1200 image IDs (should result in 3 batches of 500 each)
    const imageIds = Array.from({ length: 1200 }, (_, i) => `project:img${i}`);
    const offsetMs = -7200000;

    let callCount = 0;
    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      callCount++;
      if (callCount === 1 || callCount === 2) {
        t.equal(operations.length, 500, `Batch ${callCount} should have 500 operations`);
      } else if (callCount === 3) {
        t.equal(operations.length, 200, 'Final batch should have 200 operations');
      }
      mocks.push(`Image::BulkWrite:${callCount}`);
      return { modifiedCount: operations.length, matchedCount: operations.length };
    });

    const task = {
      projectId: 'project',
      config: {
        imageIds,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetBatch(task);

    t.deepEquals(res.imageIds, imageIds);
    t.equal(res.modifiedCount, 1200, 'Should have modified all 1200 images');
    t.equal(res.errors.length, 0, 'Should have no errors');
    t.equal(callCount, 3, 'Should have made 3 bulkWrite calls');
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['Image::BulkWrite:1', 'Image::BulkWrite:2', 'Image::BulkWrite:3']);
  Sinon.restore();
  t.end();
});

tape('Image: SetTimestampOffsetBatch - Partial modification', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const imageIds = ['project:img1', 'project:img2', 'project:img3'];
    const offsetMs = 1800000;

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake(() => {
      mocks.push('Image::BulkWrite');
      // Only 2 out of 3 were modified (one might have been deleted concurrently)
      return { modifiedCount: 2, matchedCount: 2 };
    });

    const task = {
      projectId: 'project',
      config: {
        imageIds,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetBatch(task);

    t.deepEquals(res.imageIds, imageIds);
    t.equal(res.modifiedCount, 2, 'Should have modified only 2 images');
    t.equal(res.errors.length, 1, 'Should have 1 error for failed updates');
    t.ok(res.errors[0].includes('Failed to update 1 images'));
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, ['Image::BulkWrite']);
  Sinon.restore();
  t.end();
});

tape('Image: SetTimestampOffsetBatch - Empty imageIds', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake(() => {
      mocks.push('Image::BulkWrite');
      return { modifiedCount: 0, matchedCount: 0 };
    });

    const task = {
      projectId: 'project',
      config: {
        imageIds: [],
        offsetMs: 3600000,
      },
    };

    const res = await SetTimestampOffsetBatch(task);

    t.deepEquals(res.imageIds, []);
    t.equal(res.modifiedCount, 0, 'Should have modified 0 images');
    t.equal(res.errors.length, 0, 'Should have no errors');
  } catch (err) {
    t.error(err);
  }

  t.deepEquals(mocks, [], 'Should not call bulkWrite');
  Sinon.restore();
  t.end();
});
