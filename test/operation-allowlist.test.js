import tape from 'tape';
import { parse } from 'graphql';
import {
  operationAllowlistPlugin,
  buildAllowedHashes,
  parseMode,
} from '../.build/api/plugins/operationAllowlist.js';

const KNOWN = `
  query GetImage($input: QueryImageInput!) {
    image(input: $input) { _id }
  }
`;
const UNKNOWN = 'query Sneaky { images { images { _id objects { _id } } } }';

const manifest = { version: 1, operations: { a: { document: KNOWN } } };

async function run(plugin, query, resource = '/external') {
  const hooks = await plugin.requestDidStart();
  if (!hooks) return 'skipped';
  await hooks.didResolveOperation({
    contextValue: { resource, headers: {}, user: { sub: 'u1', curr_project: 'p1' } },
    document: parse(query),
    operationName: null,
  });
  return 'allowed';
}

async function expectForbidden(t, promise, msg) {
  try {
    await promise;
    t.fail(msg);
  } catch (err) {
    t.equal(err.extensions?.code, 'FORBIDDEN', msg);
  }
}

function silenceConsole(t) {
  const { warn, error } = console;
  console.warn = () => {};
  console.error = () => {};
  t.teardown(() => {
    console.warn = warn;
    console.error = error;
  });
}

tape('OperationAllowlist: parseMode defaults to off', (t) => {
  t.equal(parseMode(undefined), 'off');
  t.equal(parseMode('bogus'), 'off');
  t.equal(parseMode('log'), 'log');
  t.equal(parseMode('enforce'), 'enforce');
  t.end();
});

tape('OperationAllowlist: hashing ignores whitespace differences', (t) => {
  const allowed = buildAllowedHashes(manifest);
  const reformatted = buildAllowedHashes({
    version: 1,
    operations: { a: { document: KNOWN.replace(/\s+/g, ' ') } },
  });
  t.deepEqual([...allowed], [...reformatted]);
  t.end();
});

tape('OperationAllowlist: skips unparseable manifest entries', (t) => {
  silenceConsole(t);
  const allowed = buildAllowedHashes({
    version: 1,
    operations: { a: { document: KNOWN }, b: { document: 'query {' } },
  });
  t.equal(allowed.size, 1);
  t.end();
});

tape('OperationAllowlist: enforce allows known and rejects unknown operations', async (t) => {
  silenceConsole(t);
  const plugin = operationAllowlistPlugin({ mode: 'enforce', loadManifest: async () => manifest });

  t.equal(await run(plugin, KNOWN), 'allowed');
  try {
    await run(plugin, UNKNOWN);
    t.fail('expected ForbiddenError');
  } catch (err) {
    t.equal(err.extensions.code, 'FORBIDDEN');
    t.equal(err.extensions.http.status, 403);
  }
});

tape('OperationAllowlist: log mode allows unknown operations but logs them', async (t) => {
  const logs = [];
  const { warn } = console;
  console.warn = (msg) => logs.push(JSON.parse(msg));
  t.teardown(() => (console.warn = warn));

  const plugin = operationAllowlistPlugin({ mode: 'log', loadManifest: async () => manifest });
  t.equal(await run(plugin, UNKNOWN), 'allowed');
  t.equal(logs.length, 1);
  t.equal(logs[0].message, 'operation_not_allowlisted');
  t.equal(logs[0].reason, 'unknown_operation');
  t.equal(logs[0].sub, 'u1');
});

tape('OperationAllowlist: /internal is exempt', async (t) => {
  let loads = 0;
  const plugin = operationAllowlistPlugin({
    mode: 'enforce',
    loadManifest: async () => (loads++, manifest),
  });
  t.equal(await run(plugin, UNKNOWN, '/internal'), 'allowed');
  t.equal(loads, 0);
});

tape('OperationAllowlist: off mode registers no hooks', async (t) => {
  const plugin = operationAllowlistPlugin({ mode: 'off', loadManifest: async () => manifest });
  t.equal(await run(plugin, UNKNOWN), 'skipped');
});

tape(
  'OperationAllowlist: enforce fails closed when manifest never loads, and backs off retries',
  async (t) => {
    silenceConsole(t);
    let clock = 0;
    let calls = 0;
    const plugin = operationAllowlistPlugin({
      mode: 'enforce',
      retryMs: 100,
      now: () => clock,
      loadManifest: async () => {
        calls++;
        throw new Error('NoSuchKey');
      },
    });
    try {
      await run(plugin, KNOWN);
      t.fail('expected ForbiddenError');
    } catch (err) {
      t.equal(err.extensions.code, 'FORBIDDEN');
    }

    clock = 50;
    await expectForbidden(t, run(plugin, KNOWN));
    t.equal(calls, 1, 'no retry before retryMs');

    clock = 150;
    await expectForbidden(t, run(plugin, KNOWN));
    t.equal(calls, 2, 'retries after retryMs');
  },
);

tape(
  'OperationAllowlist: refreshes after TTL and keeps last good manifest on failure',
  async (t) => {
    silenceConsole(t);
    let clock = 0;
    let calls = 0;
    const responses = [
      async () => ({ version: 1, operations: {} }),
      async () => manifest,
      async () => {
        throw new Error('S3 down');
      },
    ];
    const plugin = operationAllowlistPlugin({
      mode: 'enforce',
      ttlMs: 1000,
      now: () => clock,
      loadManifest: () => responses[calls++](),
    });

    await expectForbidden(t, run(plugin, KNOWN));

    clock = 500;
    await expectForbidden(t, run(plugin, KNOWN), 'cached within TTL');
    t.equal(calls, 1);

    clock = 1500;
    t.equal(await run(plugin, KNOWN), 'allowed', 'picks up new manifest after TTL');
    t.equal(calls, 2);

    clock = 3000;
    t.equal(await run(plugin, KNOWN), 'allowed', 'keeps last good manifest when refresh fails');
    t.equal(calls, 3);
  },
);

tape('OperationAllowlist: unknown operation triggers a throttled refresh before the TTL', async (t) => {
  silenceConsole(t);
  let clock = 0;
  let calls = 0;
  const responses = [async () => ({ version: 1, operations: {} }), async () => manifest];
  const plugin = operationAllowlistPlugin({
    mode: 'enforce',
    ttlMs: 60_000,
    missRefreshMs: 1000,
    now: () => clock,
    loadManifest: () => responses[Math.min(calls++, responses.length - 1)](),
  });

  await expectForbidden(t, run(plugin, KNOWN));
  t.equal(calls, 1, 'no immediate second load right after the initial load');

  clock = 500;
  await expectForbidden(t, run(plugin, KNOWN), 'miss refresh is throttled');
  t.equal(calls, 1);

  clock = 1500;
  t.equal(await run(plugin, KNOWN), 'allowed', 'miss picks up newly deployed operation');
  t.equal(calls, 2);

  clock = 1600;
  t.equal(await run(plugin, KNOWN), 'allowed');
  await expectForbidden(t, run(plugin, UNKNOWN));
  t.equal(calls, 2, 'known operations and throttled misses do not reload');
});
