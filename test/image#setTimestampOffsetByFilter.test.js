import tape from 'tape';
import Sinon from 'sinon';
import mongoose from 'mongoose';
import MockConfig from './lib/config.js';
import { ImageModel } from '../.build/api/db/models/Image.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';
import ProjectSchema from '../.build/api/db/schemas/Project.js';
import { SetTimestampOffsetByFilter } from '../.build/task/image.js';

const createMockProject = (cameraConfigs = []) => ({
  _id: 'project',
  cameraConfigs: cameraConfigs.length > 0 ? cameraConfigs : [
    {
      _id: 'camera1',
      deployments: [
        { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
      ],
    },
  ],
});

tape('Image: SetTimestampOffsetByFilter - Success with single page', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const filters = { cameras: ['camera1'] };
    const offsetMs = 3600000;
    const originalDate = new Date('2024-01-01T12:00:00Z');

    // Used by validation and setTimestampOffsetBatch for deployment remapping
    Sinon.stub(ProjectSchema, 'findById').callsFake(() => createMockProject());

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

    Sinon.stub(ImageSchema, 'find').callsFake(() => {
      mocks.push('Image::Find');
      return [
        { _id: 'project:img1', projectId: 'project', cameraId: 'camera1', dateTimeOriginal: originalDate },
        { _id: 'project:img2', projectId: 'project', cameraId: 'camera1', dateTimeOriginal: originalDate },
        { _id: 'project:img3', projectId: 'project', cameraId: 'camera1', dateTimeOriginal: originalDate },
      ];
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

  t.deepEquals(mocks, [
    'ImageModel::QueryByFilter',
    'Image::Find',
    'Image::BulkWrite',
  ]);
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
    const originalDate = new Date('2024-01-01T12:00:00Z');

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => createMockProject());

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

    Sinon.stub(ImageSchema, 'find').callsFake((query) => {
      mocks.push('Image::Find');
      return query._id.$in.map((id) => ({
        _id: id,
        projectId: 'project',
        cameraId: 'camera1',
        dateTimeOriginal: originalDate,
      }));
    });

    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      mocks.push('Image::BulkWrite');
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
    'Image::Find',
    'Image::BulkWrite',
    'ImageModel::QueryByFilter:2',
    'Image::Find',
    'Image::BulkWrite',
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
    const originalDate = new Date('2024-01-01T12:00:00Z');

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => createMockProject());

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

    Sinon.stub(ImageSchema, 'find').callsFake(() => {
      mocks.push('Image::Find');
      return [
        { _id: 'project:img1', projectId: 'project', cameraId: 'camera1', dateTimeOriginal: originalDate },
        { _id: 'project:img2', projectId: 'project', cameraId: 'camera1', dateTimeOriginal: originalDate },
        { _id: 'project:img3', projectId: 'project', cameraId: 'camera1', dateTimeOriginal: originalDate },
      ];
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

  t.deepEquals(mocks, [
    'ImageModel::QueryByFilter',
    'Image::Find',
    'Image::BulkWrite',
  ]);
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

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => createMockProject());

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

tape('Image: SetTimestampOffsetByFilter - Remaps deployment when offset changes deployment', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    const filters = { cameras: ['camera1'] };
    const offsetMs = 86400000 * 60; // 60 days forward
    const originalDate = new Date('2024-01-15T12:00:00Z'); // Image originally in default deployment
    const dep1Id = new mongoose.Types.ObjectId();
    const defaultDepId = new mongoose.Types.ObjectId();

    const projectWithDeployments = {
      _id: 'project',
      cameraConfigs: [
        {
          _id: 'camera1',
          deployments: [
            { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
            { _id: dep1Id, name: 'dep1', timezone: 'America/Los_Angeles', startDate: new Date('2024-03-01') },
          ],
        },
      ],
    };

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => projectWithDeployments);

    Sinon.stub(ImageModel, 'queryByFilter').callsFake(() => {
      mocks.push('ImageModel::QueryByFilter');
      return {
        results: [{ _id: 'project:img1' }],
        hasNext: false,
      };
    });

    Sinon.stub(ImageSchema, 'find').callsFake(() => {
      mocks.push('Image::Find');
      return [{
        _id: 'project:img1',
        projectId: 'project',
        cameraId: 'camera1',
        deploymentId: defaultDepId,
        dateTimeOriginal: originalDate,
      }];
    });

    let capturedOperations = null;
    Sinon.stub(ImageSchema, 'bulkWrite').callsFake((operations) => {
      mocks.push('Image::BulkWrite');
      capturedOperations = operations;
      return { modifiedCount: 1, matchedCount: 1 };
    });

    const task = {
      projectId: 'project',
      config: {
        filters,
        offsetMs,
      },
    };

    const res = await SetTimestampOffsetByFilter(task);

    t.equal(res.modifiedCount, 1);
    t.ok(capturedOperations, 'Should have captured operations');
    t.equal(capturedOperations.length, 1);

    const update = capturedOperations[0].updateOne.update.$set;
    t.ok(update.dateTimeAdjusted, 'Should have dateTimeAdjusted');
    t.equal(update.deploymentId.toString(), dep1Id.toString(), 'Should remap to dep1');
    t.equal(update.timezone, 'America/Los_Angeles', 'Should set timezone from new deployment');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
