import tape from 'tape';
import { DateTime } from 'luxon';
import { parseConfig, serializeConfig } from '../.build/task/utils.js';

tape('task utils: serializeConfig - tags DateTimes', (t) => {
  const iso = '2024-01-01T12:00:00.000Z';
  const res = serializeConfig({ filters: { createdStart: DateTime.fromISO(iso) } });

  t.equal(
    typeof res.filters.createdStart.__DateTime__,
    'string',
    'A Luxon DateTime would otherwise be stored as a nested BSON document',
  );
  t.equal(
    DateTime.fromISO(res.filters.createdStart.__DateTime__).toMillis(),
    DateTime.fromISO(iso).toMillis(),
  );
  t.end();
});

tape('task utils: serializeConfig - tags JS Dates', (t) => {
  const date = new Date('2024-01-01T12:00:00.000Z');
  const res = serializeConfig({ createdStart: date });

  t.equal(res.createdStart.__DateTime__, date.toISOString());
  t.end();
});

tape('task utils: serializeConfig - leaves everything else alone', (t) => {
  const config = {
    imageId: 'project:0123456789abcdef',
    labelId: '550e8400-e29b-41d4-a716-446655440000',
    cameraId: 'camera1',
    reviewed: false,
    limit: 500,
    next: null,
    cameras: ['camera-a', 'camera-b'],
  };

  t.deepEquals(serializeConfig(config), config);
  t.end();
});

tape('task utils: serializeConfig - handles null and undefined', (t) => {
  t.equal(serializeConfig(null), null);
  t.equal(serializeConfig(undefined), null);
  t.end();
});

tape('task utils: parseConfig - revives tagged dates', (t) => {
  const iso = '2024-01-01T12:00:00.000Z';
  const res = parseConfig({ filters: { createdStart: { __DateTime__: iso } } });

  t.ok(DateTime.isDateTime(res.filters.createdStart), 'Should be a Luxon DateTime');
  t.equal(res.filters.createdStart.toMillis(), DateTime.fromISO(iso).toMillis());
  t.end();
});

tape('task utils: parseConfig - leaves untagged ISO strings as strings', (t) => {
  // Only serializeConfig decides what is a date, so a bare string is just a string
  const config = { createdStart: '2024-01-01T12:00:00.000Z' };
  const res = parseConfig(config);

  t.equal(typeof res.createdStart, 'string');
  t.deepEquals(res, config);
  t.end();
});

tape('task utils: parseConfig - leaves numeric strings alone', (t) => {
  // Luxon's fromISO() accepts "24", "1234" and "20240101", so heuristic detection used to turn
  // camera serial numbers into dates. https://github.com/tnc-ca-geo/animl-api/issues/166
  const config = {
    cameraId: '24',
    newSerialNumber: '20240101',
    other: '1234',
    time: '12:30',
  };

  t.deepEquals(parseConfig(config), config, 'Numeric identifiers must survive untouched');
  t.end();
});

tape('task utils: parseConfig - leaves numeric strings inside arrays alone', (t) => {
  const config = { filters: { cameras: ['1234', 'camera1'] } };

  t.deepEquals(parseConfig(config), config);
  t.end();
});

tape('task utils: parseConfig - does not mutate its input', (t) => {
  const iso = '2024-01-01T12:00:00.000Z';
  const config = { filters: { createdStart: { __DateTime__: iso } } };
  parseConfig(config);

  t.equal(config.filters.createdStart.__DateTime__, iso, 'Original should be unchanged');
  t.end();
});

tape('task utils: round-trips DateTimes through serialize and parse', (t) => {
  const original = {
    filters: {
      createdStart: DateTime.fromISO('2024-01-01T12:00:00.000Z'),
      createdEnd: DateTime.fromISO('2024-12-31T23:59:59.000Z'),
      cameras: ['camera-a'],
    },
    imageIds: ['project:abc', 'project:def'],
    offsetMs: 3600000,
  };

  const res = parseConfig(serializeConfig(original));

  t.ok(DateTime.isDateTime(res.filters.createdStart), 'createdStart should survive the round-trip');
  t.ok(DateTime.isDateTime(res.filters.createdEnd), 'createdEnd should survive the round-trip');
  t.equal(res.filters.createdStart.toMillis(), original.filters.createdStart.toMillis());
  t.equal(res.filters.createdEnd.toMillis(), original.filters.createdEnd.toMillis());
  t.deepEquals(res.filters.cameras, ['camera-a']);
  t.deepEquals(res.imageIds, ['project:abc', 'project:def']);
  t.equal(res.offsetMs, 3600000);
  t.end();
});

tape('task utils: round-trips dates nested in arrays', (t) => {
  const original = { ranges: [{ start: DateTime.fromISO('2024-01-01T00:00:00.000Z') }] };

  const res = parseConfig(serializeConfig(original));

  t.ok(DateTime.isDateTime(res.ranges[0].start));
  t.equal(res.ranges[0].start.toMillis(), original.ranges[0].start.toMillis());
  t.end();
});

tape('task utils: round-trips a config with no dates at all', (t) => {
  const original = {
    imageIds: ['project:abc', '1234'],
    filters: { cameras: ['24'], reviewed: null },
  };

  t.deepEquals(parseConfig(serializeConfig(original)), original);
  t.end();
});
