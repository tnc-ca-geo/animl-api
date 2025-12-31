import tape from 'tape';
import Sinon from 'sinon';
import mongoose from 'mongoose';
import MockConfig from './lib/config.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';
import ProjectSchema from '../.build/api/db/schemas/Project.js';
import { validateTimestampOffsetChangeset } from '../.build/task/image.js';

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

tape('validateTimestampOffsetChangeset - passes when no multi-timezone cameras exist', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => {
      mocks.push('Project::FindById');
      return createMockProject();
    });

    Sinon.stub(ImageSchema, 'aggregate').callsFake(() => {
      mocks.push('Image::Aggregate');
      return [];
    });

    await validateTimestampOffsetChangeset('project', { cameras: ['camera1'] });
    t.pass('Should not throw when no multi-timezone cameras');
    t.notOk(mocks.includes('Image::Aggregate'), 'Should not call aggregate when no multi-timezone cameras');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('validateTimestampOffsetChangeset - passes when multi-timezone camera has no matching images', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const multiTzProject = createMockProject([
      {
        _id: 'camera1',
        deployments: [
          { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
          { _id: new mongoose.Types.ObjectId(), name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-01-01') },
        ],
      },
    ]);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => multiTzProject);
    Sinon.stub(ImageSchema, 'aggregate').callsFake(() => []); // No matching images

    await validateTimestampOffsetChangeset('project', { cameras: ['camera1'] });
    t.pass('Should not throw when no images match filter in multi-timezone cameras');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('validateTimestampOffsetChangeset - throws when images exist in multi-timezone camera', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const multiTzProject = createMockProject([
      {
        _id: 'camera1',
        deployments: [
          { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
          { _id: new mongoose.Types.ObjectId(), name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-01-01') },
        ],
      },
    ]);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => multiTzProject);
    Sinon.stub(ImageSchema, 'aggregate').callsFake(() => [{ count: 5 }]);

    try {
      await validateTimestampOffsetChangeset('project', { cameras: ['camera1'] });
      t.fail('Should have thrown ForbiddenError');
    } catch (err) {
      t.ok(err.message.includes('multiple timezones'), 'Should throw error about multiple timezones');
    }
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('validateTimestampOffsetChangeset - only checks cameras with multiple timezones', async (t) => {
  let aggregatePipeline = null;

  try {
    Sinon.restore();
    MockConfig(t);

    // camera1 has multiple timezones, camera2 has single timezone
    const mixedProject = createMockProject([
      {
        _id: 'camera1',
        deployments: [
          { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
          { _id: new mongoose.Types.ObjectId(), name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-01-01') },
        ],
      },
      {
        _id: 'camera2',
        deployments: [
          { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
        ],
      },
    ]);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => mixedProject);
    Sinon.stub(ImageSchema, 'aggregate').callsFake((pipeline) => {
      aggregatePipeline = pipeline;
      return [];
    });

    await validateTimestampOffsetChangeset('project', { cameras: ['camera1', 'camera2'] });

    t.ok(aggregatePipeline, 'Should have called aggregate');
    // The validation adds a camera restriction at the end of the pipeline (before $count)
    const countIndex = aggregatePipeline.findIndex((stage) => stage.$count);
    const cameraMatch = aggregatePipeline[countIndex - 1];
    t.ok(cameraMatch?.$match?.cameraId, 'Should have camera match stage before count');
    t.deepEquals(cameraMatch.$match.cameraId.$in, ['camera1'], 'Should only check multi-timezone camera');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('validateTimestampOffsetChangeset (imageIds) - passes when no multi-timezone cameras exist', async (t) => {
  const mocks = [];

  try {
    Sinon.restore();
    MockConfig(t);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => createMockProject());

    Sinon.stub(ImageSchema, 'aggregate').callsFake(() => {
      mocks.push('Image::Aggregate');
      return [];
    });

    await validateTimestampOffsetChangeset('project', undefined, ['img1', 'img2']);
    t.pass('Should not throw when no multi-timezone cameras');
    t.notOk(mocks.includes('Image::Aggregate'), 'Should not call aggregate when no multi-timezone cameras');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('validateTimestampOffsetChangeset (imageIds) - passes when images not in multi-timezone cameras', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const multiTzProject = createMockProject([
      {
        _id: 'camera1',
        deployments: [
          { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
          { _id: new mongoose.Types.ObjectId(), name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-01-01') },
        ],
      },
    ]);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => multiTzProject);
    Sinon.stub(ImageSchema, 'aggregate').callsFake(() => []); // No matching images

    await validateTimestampOffsetChangeset('project', undefined, ['img1', 'img2']);
    t.pass('Should not throw when images are not in multi-timezone cameras');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('validateTimestampOffsetChangeset (imageIds) - throws when images exist in multi-timezone camera', async (t) => {
  try {
    Sinon.restore();
    MockConfig(t);

    const multiTzProject = createMockProject([
      {
        _id: 'camera1',
        deployments: [
          { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
          { _id: new mongoose.Types.ObjectId(), name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-01-01') },
        ],
      },
    ]);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => multiTzProject);
    Sinon.stub(ImageSchema, 'aggregate').callsFake(() => [{ count: 2 }]);

    try {
      await validateTimestampOffsetChangeset('project', undefined, ['img1', 'img2']);
      t.fail('Should have thrown ForbiddenError');
    } catch (err) {
      t.ok(err.message.includes('multiple timezones'), 'Should throw error about multiple timezones');
    }
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('validateTimestampOffsetChangeset (imageIds) - builds correct pipeline', async (t) => {
  let aggregatePipeline = null;

  try {
    Sinon.restore();
    MockConfig(t);

    const multiTzProject = createMockProject([
      {
        _id: 'camera1',
        deployments: [
          { _id: new mongoose.Types.ObjectId(), name: 'default', timezone: 'America/Los_Angeles' },
          { _id: new mongoose.Types.ObjectId(), name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-01-01') },
        ],
      },
    ]);

    Sinon.stub(ProjectSchema, 'findById').callsFake(() => multiTzProject);
    Sinon.stub(ImageSchema, 'aggregate').callsFake((pipeline) => {
      aggregatePipeline = pipeline;
      return [];
    });

    await validateTimestampOffsetChangeset('project', undefined, ['img1', 'img2']);

    t.ok(aggregatePipeline, 'Should have called aggregate');
    t.equal(aggregatePipeline.length, 3, 'Pipeline should have 3 stages');
    t.deepEquals(aggregatePipeline[0].$match._id.$in, ['img1', 'img2'], 'First stage should match imageIds');
    t.deepEquals(aggregatePipeline[1].$match.cameraId.$in, ['camera1'], 'Second stage should match multi-tz cameras');
    t.ok(aggregatePipeline[2].$count, 'Third stage should be $count');
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
