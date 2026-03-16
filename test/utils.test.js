import tape from 'tape';
import mongoose from 'mongoose';
import {
  getMultiTimezoneCameras,
  findDeploymentForAdjustedTime,
  getQueryableLabelIds,
} from '../.build/api/db/models/utils.js';

tape('getMultiTimezoneCameras - returns empty set when no cameras have multiple timezones', (t) => {
  const cameraConfigs = [
    {
      _id: 'camera1',
      deployments: [
        { name: 'default', timezone: 'America/Los_Angeles' },
        { name: 'dep1', timezone: 'America/Los_Angeles', startDate: new Date('2024-01-01') },
      ],
    },
    {
      _id: 'camera2',
      deployments: [{ name: 'default', timezone: 'America/New_York' }],
    },
  ];

  const result = getMultiTimezoneCameras(cameraConfigs);

  t.equals(result.size, 0);
  t.end();
});

tape('getMultiTimezoneCameras - returns cameras with multiple timezones', (t) => {
  const cameraConfigs = [
    {
      _id: 'camera1',
      deployments: [
        { name: 'default', timezone: 'America/Los_Angeles' },
        { name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-01-01') },
      ],
    },
    {
      _id: 'camera2',
      deployments: [{ name: 'default', timezone: 'America/Los_Angeles' }],
    },
  ];

  const result = getMultiTimezoneCameras(cameraConfigs);

  t.equals(result.size, 1);
  t.ok(result.has('camera1'));
  t.notOk(result.has('camera2'));
  t.end();
});

tape('getMultiTimezoneCameras - returns empty set for empty camera configs', (t) => {
  const result = getMultiTimezoneCameras([]);

  t.equals(result.size, 0);
  t.end();
});

tape(
  'findDeploymentForAdjustedTime - returns default deployment when timestamp is before all deployments',
  (t) => {
    const defaultDepId = new mongoose.Types.ObjectId();
    const dep1Id = new mongoose.Types.ObjectId();

    const camConfig = {
      _id: 'camera1',
      deployments: [
        { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
        {
          _id: dep1Id,
          name: 'dep1',
          timezone: 'America/Los_Angeles',
          startDate: new Date('2024-06-01'),
        },
      ],
    };

    const timestamp = new Date('2024-01-01');
    const result = findDeploymentForAdjustedTime(timestamp, camConfig);

    t.equals(result._id.toString(), defaultDepId.toString());
    t.equals(result.name, 'default');
    t.end();
  },
);

tape(
  'findDeploymentForAdjustedTime - returns correct deployment when timestamp is after deployment start',
  (t) => {
    const defaultDepId = new mongoose.Types.ObjectId();
    const dep1Id = new mongoose.Types.ObjectId();

    const camConfig = {
      _id: 'camera1',
      deployments: [
        { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
        {
          _id: dep1Id,
          name: 'dep1',
          timezone: 'America/New_York',
          startDate: new Date('2024-06-01'),
        },
      ],
    };

    const timestamp = new Date('2024-07-01');
    const result = findDeploymentForAdjustedTime(timestamp, camConfig);

    t.equals(result._id.toString(), dep1Id.toString());
    t.equals(result.name, 'dep1');
    t.end();
  },
);

tape(
  'findDeploymentForAdjustedTime - returns most recent deployment when multiple deployments precede timestamp',
  (t) => {
    const defaultDepId = new mongoose.Types.ObjectId();
    const dep1Id = new mongoose.Types.ObjectId();
    const dep2Id = new mongoose.Types.ObjectId();

    const camConfig = {
      _id: 'camera1',
      deployments: [
        { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
        {
          _id: dep1Id,
          name: 'dep1',
          timezone: 'America/New_York',
          startDate: new Date('2024-03-01'),
        },
        {
          _id: dep2Id,
          name: 'dep2',
          timezone: 'America/Chicago',
          startDate: new Date('2024-06-01'),
        },
      ],
    };

    const timestamp = new Date('2024-07-01');
    const result = findDeploymentForAdjustedTime(timestamp, camConfig);

    t.equals(result._id.toString(), dep2Id.toString());
    t.equals(result.name, 'dep2');
    t.end();
  },
);

tape('findDeploymentForAdjustedTime - returns default when only default deployment exists', (t) => {
  const defaultDepId = new mongoose.Types.ObjectId();

  const camConfig = {
    _id: 'camera1',
    deployments: [{ _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' }],
  };

  const timestamp = new Date('2024-07-01');
  const result = findDeploymentForAdjustedTime(timestamp, camConfig);

  t.equals(result._id.toString(), defaultDepId.toString());
  t.equals(result.name, 'default');
  t.end();
});

tape('getQueryableLabelIds - returns ["none"] when image has no objects', (t) => {
  const image = { objects: [] };
  const result = getQueryableLabelIds(image);
  t.deepEquals(result, ['none']);
  t.end();
});

tape('getQueryableLabelIds - returns ["none"] when objects is undefined', (t) => {
  const image = {};
  const result = getQueryableLabelIds(image);
  t.deepEquals(result, ['none']);
  t.end();
});

tape('getQueryableLabelIds - returns first validated label for a locked object', (t) => {
  const image = {
    objects: [
      {
        locked: true,
        labels: [
          { labelId: 'invalidated-label', validation: { validated: false } },
          { labelId: 'validated-label', validation: { validated: true } },
          { labelId: 'also-validated', validation: { validated: true } },
        ],
      },
    ],
  };
  const result = getQueryableLabelIds(image);
  t.deepEquals(result, ['validated-label']);
  t.end();
});

tape('getQueryableLabelIds - returns ["none"] when locked object has no validated labels', (t) => {
  const image = {
    objects: [
      {
        locked: true,
        labels: [
          { labelId: 'label-a', validation: { validated: false } },
          { labelId: 'label-b', validation: { validated: false } },
        ],
      },
    ],
  };
  const result = getQueryableLabelIds(image);
  t.deepEquals(result, ['none']);
  t.end();
});

tape('getQueryableLabelIds - includes all non-invalidated labels for unlocked object', (t) => {
  const image = {
    objects: [
      {
        locked: false,
        labels: [
          { labelId: 'label-a', validation: null },
          { labelId: 'label-b', validation: { validated: true } },
          { labelId: 'label-c', validation: { validated: false } },
        ],
      },
    ],
  };
  const result = getQueryableLabelIds(image);
  t.ok(result.includes('label-a'));
  t.ok(result.includes('label-b'));
  t.notOk(result.includes('label-c'));
  t.equals(result.length, 2);
  t.end();
});

tape('getQueryableLabelIds - includes labels with no validation field for unlocked object', (t) => {
  const image = {
    objects: [
      {
        locked: false,
        labels: [{ labelId: 'no-validation-label' }],
      },
    ],
  };
  const result = getQueryableLabelIds(image);
  t.deepEquals(result, ['no-validation-label']);
  t.end();
});

tape('getQueryableLabelIds - deduplicates label IDs across multiple objects', (t) => {
  const image = {
    objects: [
      {
        locked: false,
        labels: [{ labelId: 'label-a', validation: null }],
      },
      {
        locked: false,
        labels: [{ labelId: 'label-a', validation: null }],
      },
    ],
  };
  const result = getQueryableLabelIds(image);
  t.deepEquals(result, ['label-a']);
  t.end();
});

tape('getQueryableLabelIds - combines labels from locked and unlocked objects', (t) => {
  const image = {
    objects: [
      {
        locked: true,
        labels: [
          { labelId: 'locked-validated', validation: { validated: true } },
          { labelId: 'locked-other', validation: { validated: true } },
        ],
      },
      {
        locked: false,
        labels: [
          { labelId: 'unlocked-a', validation: null },
          { labelId: 'unlocked-b', validation: { validated: false } },
        ],
      },
    ],
  };
  const result = getQueryableLabelIds(image);
  t.ok(result.includes('locked-validated'));
  t.notOk(result.includes('locked-other'));
  t.ok(result.includes('unlocked-a'));
  t.notOk(result.includes('unlocked-b'));
  t.equals(result.length, 2);
  t.end();
});

tape(
  'getQueryableLabelIds - returns ["none"] when all labels on all objects are invalidated',
  (t) => {
    const image = {
      objects: [
        {
          locked: true,
          labels: [{ labelId: 'label-a', validation: { validated: false } }],
        },
        {
          locked: false,
          labels: [{ labelId: 'label-b', validation: { validated: false } }],
        },
      ],
    };
    const result = getQueryableLabelIds(image);
    t.deepEquals(result, ['none']);
    t.end();
  },
);

tape('getQueryableLabelIds - locked object with empty labels returns ["none"]', (t) => {
  const image = {
    objects: [
      {
        locked: true,
        labels: [],
      },
    ],
  };
  const result = getQueryableLabelIds(image);
  t.deepEquals(result, ['none']);
  t.end();
});
