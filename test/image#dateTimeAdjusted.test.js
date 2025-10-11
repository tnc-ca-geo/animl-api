import tape from 'tape';
import Sinon from 'sinon';
import MockConfig from './lib/config.js';
import ImageSchema from '../.build/api/db/schemas/Image.js';

process.env.AWS_REGION = process.env.REGION = 'us-east-2';
process.env.STAGE = 'dev';

tape('Image: dateTimeAdjusted - No offset', async (t) => {
  try {
    MockConfig(t);

    const baseDate = new Date('2024-01-15T10:30:00.000Z');
    const image = new ImageSchema({
      _id: 'test-project:test-no-offset',
      bucket: 'test-bucket',
      fileTypeExtension: 'jpg',
      dateAdded: new Date(),
      dateTimeOriginal: baseDate,
      timezone: 'America/Los_Angeles',
      make: 'Canon',
      cameraId: 'test-camera',
      deploymentId: '507f1f77bcf86cd799439011',
      projectId: 'test-project'
    });

    t.deepEqual(
      image.dateTimeAdjusted,
      baseDate,
      'dateTimeAdjusted should return original timestamp when no offset is set'
    );
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});

tape('Image: dateTimeAdjusted - Various offsets', async (t) => {
  try {
    MockConfig(t);

    const baseISO = '2024-01-15T10:30:00.000Z';
    const baseDate = new Date(baseISO);

    const testCases = [
      {
        offsetMs: 3600000,
        expectedISO: '2024-01-15T11:30:00.000Z',
        description: '+1 hour (3600000ms)',
      },
      {
        offsetMs: 1800000,
        expectedISO: '2024-01-15T11:00:00.000Z',
        description: '+30 minutes (1800000ms)',
      },
      {
        offsetMs: -1800000,
        expectedISO: '2024-01-15T10:00:00.000Z',
        description: '-30 minutes (-1800000ms)',
      },
      {
        offsetMs: 0,
        expectedISO: '2024-01-15T10:30:00.000Z',
        description: 'zero offset',
      },
      {
        offsetMs: 86400000 * 365,
        expectedISO: '2025-01-14T10:30:00.000Z', // leap year
        description: '+365 days (31536000000ms)',
      },
      {
        offsetMs: -86400000 * 30,
        expectedISO: '2023-12-16T10:30:00.000Z',
        description: '-30 days (-2592000000ms)',
      },
    ];

    for (const testCase of testCases) {
      const image = new ImageSchema({
        _id: `test-project:test-${testCase.offsetMs}`,
        bucket: 'test-bucket',
        fileTypeExtension: 'jpg',
        dateAdded: new Date(),
        dateTimeOriginal: baseDate,
        timezone: 'America/Los_Angeles',
        make: 'Canon',
        cameraId: 'test-camera',
        deploymentId: '507f1f77bcf86cd799439011',
        projectId: 'test-project',
        dateTimeOffsetMs: testCase.offsetMs,
      });

      t.equal(
        image.dateTimeAdjusted.toISOString(),
        testCase.expectedISO,
        `${testCase.description}: should result in ${testCase.expectedISO}`
      );

      t.deepEqual(
        image.dateTimeOriginal,
        baseDate,
        `${testCase.description}: dateTimeOriginal should remain unchanged`
      );
    }
  } catch (err) {
    t.error(err);
  }

  Sinon.restore();
  t.end();
});
