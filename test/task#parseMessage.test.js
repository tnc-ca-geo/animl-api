import tape from 'tape';
import { DateTime } from 'luxon';
import { parseMessage, serializeConfig } from '../.build/task/utils.js';

tape('task utils: parseMessage - converts top-level ISO strings to DateTimes', (t) => {
  const iso = '2024-01-01T12:00:00.000Z';
  const res = parseMessage({ createdStart: iso });

  t.ok(DateTime.isDateTime(res.createdStart), 'Should be a Luxon DateTime');
  t.equal(res.createdStart.toMillis(), DateTime.fromISO(iso).toMillis());
  t.end();
});

tape('task utils: parseMessage - converts nested ISO strings to DateTimes', (t) => {
  const iso = '2024-06-15T08:30:00.000Z';
  const res = parseMessage({ filters: { createdStart: iso, cameras: ['camera-a'] } });

  t.ok(DateTime.isDateTime(res.filters.createdStart), 'Should be a Luxon DateTime');
  t.equal(res.filters.createdStart.toMillis(), DateTime.fromISO(iso).toMillis());
  t.deepEquals(res.filters.cameras, ['camera-a'], 'Non-date array should be untouched');
  t.end();
});

tape('task utils: parseMessage - converts ISO strings inside arrays', (t) => {
  const isoA = '2024-01-01T00:00:00.000Z';
  const isoB = '2024-02-01T00:00:00.000Z';
  const res = parseMessage({ dates: [isoA, isoB] });

  t.equal(res.dates.length, 2);
  t.ok(DateTime.isDateTime(res.dates[0]), 'First element should be a DateTime');
  t.ok(DateTime.isDateTime(res.dates[1]), 'Second element should be a DateTime');
  t.equal(res.dates[0].toMillis(), DateTime.fromISO(isoA).toMillis());
  t.equal(res.dates[1].toMillis(), DateTime.fromISO(isoB).toMillis());
  t.end();
});

tape('task utils: parseMessage - leaves non-date strings alone', (t) => {
  const config = {
    imageId: 'project:0123456789abcdef',
    labelId: '550e8400-e29b-41d4-a716-446655440000',
    projectId: 'default_project',
    cameraId: 'camera1',
  };
  const res = parseMessage(config);

  t.deepEquals(res, config, 'Identifiers should survive untouched');
  t.end();
});

tape('task utils: parseMessage - preserves null, booleans and numbers', (t) => {
  const config = { next: null, reviewed: false, limit: 500 };
  const res = parseMessage(config);

  t.equal(res.next, null);
  t.equal(res.reviewed, false);
  t.equal(res.limit, 500);
  t.end();
});

tape('task utils: parseMessage - leaves Date objects alone', (t) => {
  // Mongo returns BSON dates as JS Dates, not ISO strings
  const date = new Date('2024-01-01T12:00:00.000Z');
  const res = parseMessage({ createdStart: date });

  t.ok(res.createdStart instanceof Date, 'Should still be a Date');
  t.equal(res.createdStart.getTime(), date.getTime());
  t.end();
});

tape('task utils: parseMessage - does not mutate its input', (t) => {
  const iso = '2024-01-01T12:00:00.000Z';
  const config = { filters: { createdStart: iso } };
  parseMessage(config);

  t.equal(config.filters.createdStart, iso, 'Original should be unchanged');
  t.end();
});

tape('task utils: serializeConfig - converts DateTimes to ISO strings', (t) => {
  const iso = '2024-01-01T12:00:00.000Z';
  const res = serializeConfig({ filters: { createdStart: DateTime.fromISO(iso) } });

  t.equal(typeof res.filters.createdStart, 'string', 'Should be a plain string, not a BSON object');
  t.equal(DateTime.fromISO(res.filters.createdStart).toMillis(), DateTime.fromISO(iso).toMillis());
  t.end();
});

tape('task utils: serializeConfig - handles null and undefined', (t) => {
  t.equal(serializeConfig(null), null);
  t.equal(serializeConfig(undefined), null);
  t.end();
});

tape('task utils: serializeConfig -> parseMessage round-trips DateTimes', (t) => {
  const original = {
    filters: {
      createdStart: DateTime.fromISO('2024-01-01T12:00:00.000Z'),
      createdEnd: DateTime.fromISO('2024-12-31T23:59:59.000Z'),
      cameras: ['camera-a'],
    },
    imageIds: ['project:abc', 'project:def'],
  };

  const res = parseMessage(serializeConfig(original));

  t.ok(DateTime.isDateTime(res.filters.createdStart), 'createdStart should survive the round-trip');
  t.ok(DateTime.isDateTime(res.filters.createdEnd), 'createdEnd should survive the round-trip');
  t.equal(res.filters.createdStart.toMillis(), original.filters.createdStart.toMillis());
  t.equal(res.filters.createdEnd.toMillis(), original.filters.createdEnd.toMillis());
  t.deepEquals(res.filters.cameras, ['camera-a']);
  t.deepEquals(res.imageIds, ['project:abc', 'project:def']);
  t.end();
});

// CHARACTERIZATION TESTS - these pin a known bug, not desired behavior.
// isValidISOString() trusts DateTime.fromISO().isValid, which accepts bare numeric strings
// ("24" -> day-of-month, "2024" -> year, "20240101" -> full date). Any all-numeric config value
// is therefore silently converted into a DateTime. The clearest victim is UpdateSerialNumber,
// whose config carries camera serial numbers that are routinely all digits.
// When this is fixed, these assertions should be inverted.
tape('task utils: parseMessage - KNOWN BUG converts numeric strings to DateTimes', (t) => {
  const res = parseMessage({
    cameraId: '24',
    newSerialNumber: '20240101',
    other: '1234',
  });

  t.ok(DateTime.isDateTime(res.cameraId), 'BUG: "24" is parsed as a day-of-month');
  t.ok(DateTime.isDateTime(res.newSerialNumber), 'BUG: "20240101" is parsed as a date');
  t.ok(DateTime.isDateTime(res.other), 'BUG: "1234" is parsed as a year');
  t.end();
});

tape('task utils: parseMessage - KNOWN BUG converts numeric strings inside arrays', (t) => {
  const res = parseMessage({ filters: { cameras: ['1234', 'camera1'] } });

  t.ok(DateTime.isDateTime(res.filters.cameras[0]), 'BUG: numeric camera id is parsed as a date');
  t.equal(res.filters.cameras[1], 'camera1', 'Non-numeric camera id is untouched');
  t.end();
});
