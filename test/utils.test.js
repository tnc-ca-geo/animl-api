import tape from 'tape';
import mongoose from 'mongoose';
import { getMultiTimezoneCameras, findDeploymentForAdjustedTime } from '../.build/api/db/models/utils.js';

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
      deployments: [
        { name: 'default', timezone: 'America/New_York' },
      ],
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
      deployments: [
        { name: 'default', timezone: 'America/Los_Angeles' },
      ],
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

tape('findDeploymentForAdjustedTime - returns default deployment when timestamp is before all deployments', (t) => {
  const defaultDepId = new mongoose.Types.ObjectId();
  const dep1Id = new mongoose.Types.ObjectId();

  const camConfig = {
    _id: 'camera1',
    deployments: [
      { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
      { _id: dep1Id, name: 'dep1', timezone: 'America/Los_Angeles', startDate: new Date('2024-06-01') },
    ],
  };

  const timestamp = new Date('2024-01-01');
  const result = findDeploymentForAdjustedTime(timestamp, camConfig);

  t.equals(result._id.toString(), defaultDepId.toString());
  t.equals(result.name, 'default');
  t.end();
});

tape('findDeploymentForAdjustedTime - returns correct deployment when timestamp is after deployment start', (t) => {
  const defaultDepId = new mongoose.Types.ObjectId();
  const dep1Id = new mongoose.Types.ObjectId();

  const camConfig = {
    _id: 'camera1',
    deployments: [
      { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
      { _id: dep1Id, name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-06-01') },
    ],
  };

  const timestamp = new Date('2024-07-01');
  const result = findDeploymentForAdjustedTime(timestamp, camConfig);

  t.equals(result._id.toString(), dep1Id.toString());
  t.equals(result.name, 'dep1');
  t.end();
});

tape('findDeploymentForAdjustedTime - returns most recent deployment when multiple deployments precede timestamp', (t) => {
  const defaultDepId = new mongoose.Types.ObjectId();
  const dep1Id = new mongoose.Types.ObjectId();
  const dep2Id = new mongoose.Types.ObjectId();

  const camConfig = {
    _id: 'camera1',
    deployments: [
      { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
      { _id: dep1Id, name: 'dep1', timezone: 'America/New_York', startDate: new Date('2024-03-01') },
      { _id: dep2Id, name: 'dep2', timezone: 'America/Chicago', startDate: new Date('2024-06-01') },
    ],
  };

  const timestamp = new Date('2024-07-01');
  const result = findDeploymentForAdjustedTime(timestamp, camConfig);

  t.equals(result._id.toString(), dep2Id.toString());
  t.equals(result.name, 'dep2');
  t.end();
});

tape('findDeploymentForAdjustedTime - returns default when only default deployment exists', (t) => {
  const defaultDepId = new mongoose.Types.ObjectId();

  const camConfig = {
    _id: 'camera1',
    deployments: [
      { _id: defaultDepId, name: 'default', timezone: 'America/Los_Angeles' },
    ],
  };

  const timestamp = new Date('2024-07-01');
  const result = findDeploymentForAdjustedTime(timestamp, camConfig);

  t.equals(result._id.toString(), defaultDepId.toString());
  t.equals(result.name, 'default');
  t.end();
});
