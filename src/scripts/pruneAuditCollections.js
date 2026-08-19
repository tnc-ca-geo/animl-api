/*
 * pruneAuditCollections.js
 *
 * Adds TTL indexes to the two audit collections that grow without bound:
 * imageattempts and imageerrors. Together they are ~11 GB of the ~31 GB
 * animl-prod dataSize, and imageerrors is ~97% duplicate-key records.
 *
 * Why this matters: Atlas Backup is billed on snapshot storage, so every GB of
 * audit data is re-paid across 51 retained snapshots.
 *
 * Deleting ~22M documents in one pass would flood the oplog, which is itself
 * billed for the point-in-time-restore window. So the backlog is purged in
 * paced batches first, and the TTL index is created last to hold the steady
 * state. Pass --ttl-only to skip the paced purge and let MongoDB's TTL monitor
 * drain the backlog at its own rate instead.
 *
 * Dry run (default):
 *   STAGE=dev npm run prune-audit-dev
 *
 * Apply:
 *   STAGE=dev npm run prune-audit-dev -- --apply
 *
 * Note: ImageAttempt is not purely an audit record. Image.createImage() looks
 * one up by its deterministic `<projectId>:<hash>` _id before creating a new
 * one. Pruning an old attempt is still safe: a later re-upload simply registers
 * a fresh attempt, and duplicate detection happens against the images
 * collection, not this one.
 */

import prompt from 'prompt';
import { connectToDatabase } from '../../.build/api/db/connect.js';
import { getConfig } from '../../.build/config/config.js';

const COLLECTIONS = [
  { name: 'imageattempts', field: 'created', retentionDays: 180 },
  { name: 'imageerrors', field: 'created', retentionDays: 180 },
];

const BATCH_SIZE = 5000;
const PAUSE_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const GB = (bytes) => (bytes / 1e9).toFixed(2);

function parseArgs(argv) {
  const args = { apply: false, ttlOnly: false, retentionDays: null };
  for (const arg of argv.slice(2)) {
    if (arg === '--apply') args.apply = true;
    else if (arg === '--ttl-only') args.ttlOnly = true;
    else if (arg.startsWith('--retention-days=')) {
      args.retentionDays = parseInt(arg.split('=')[1], 10);
    }
  }
  return args;
}

async function confirm(message) {
  prompt.start();
  const { confirmation } = await prompt.get({
    properties: {
      confirmation: {
        name: 'confirmation',
        message,
        validator: /y[es]*|n[o]?/,
        warning: 'Must respond yes or no',
        default: 'no',
      },
    },
  });
  return /^y/.test(confirmation);
}

async function collectionStats(db, name) {
  try {
    const stats = await db.command({ collStats: name, scale: 1 });
    return { count: stats.count ?? 0, size: stats.size ?? 0, indexSize: stats.totalIndexSize ?? 0 };
  } catch {
    return { count: 0, size: 0, indexSize: 0 };
  }
}

async function pruneBatched(collection, field, cutoff) {
  let deleted = 0;
  for (;;) {
    const docs = await collection
      .find({ [field]: { $lt: cutoff } }, { projection: { _id: 1 } })
      .limit(BATCH_SIZE)
      .toArray();
    if (docs.length === 0) break;

    const res = await collection.deleteMany({ _id: { $in: docs.map((d) => d._id) } });
    deleted += res.deletedCount;
    process.stdout.write(`\r    deleted ${deleted.toLocaleString()}...`);
    // Let the oplog and any secondaries catch up between batches.
    await sleep(PAUSE_MS);
  }
  if (deleted > 0) process.stdout.write('\n');
  return deleted;
}

async function ensureTtlIndex(collection, field, retentionDays) {
  const seconds = retentionDays * 24 * 60 * 60;
  const indexes = await collection.indexes();
  const existing = indexes.find(
    (i) => Object.keys(i.key).length === 1 && i.key[field] === 1,
  );

  if (existing && existing.expireAfterSeconds === seconds) {
    console.log(`    TTL index already set to ${retentionDays}d`);
    return;
  }
  if (existing && existing.expireAfterSeconds !== undefined) {
    await collection.dropIndex(existing.name);
    console.log(`    dropped TTL index at ${existing.expireAfterSeconds / 86400}d`);
  } else if (existing) {
    // A plain index on the same key cannot be converted in place.
    await collection.dropIndex(existing.name);
    console.log(`    dropped non-TTL index ${existing.name}`);
  }

  await collection.createIndex({ [field]: 1 }, { expireAfterSeconds: seconds, background: true });
  console.log(`    created TTL index on ${field} at ${retentionDays}d`);
}

async function main() {
  const args = parseArgs(process.argv);
  const stage = process.env.STAGE || 'dev';
  const config = await getConfig();
  const mongoose = await connectToDatabase(config);
  const db = mongoose.connection.db;

  console.log(`\nPruning audit collections in animl-${stage}`);
  console.log(args.apply ? '  MODE: APPLY\n' : '  MODE: DRY RUN (pass --apply to execute)\n');

  const plan = [];
  for (const spec of COLLECTIONS) {
    const retentionDays = args.retentionDays ?? spec.retentionDays;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const collection = db.collection(spec.name);
    const stats = await collectionStats(db, spec.name);
    const expired = await collection.countDocuments({ [spec.field]: { $lt: cutoff } });

    const share = stats.count ? (100 * expired) / stats.count : 0;
    console.log(`  ${spec.name}`);
    console.log(`    documents        ${stats.count.toLocaleString()}`);
    console.log(`    data / index     ${GB(stats.size)} GB / ${GB(stats.indexSize)} GB`);
    console.log(`    retention        ${retentionDays} days (cutoff ${cutoff.toISOString().slice(0, 10)})`);
    console.log(`    would delete     ${expired.toLocaleString()} (${share.toFixed(1)}%)`);
    console.log(`    would reclaim    ~${GB(stats.count ? (stats.size * expired) / stats.count : 0)} GB\n`);

    plan.push({ ...spec, retentionDays, cutoff, collection, stats, expired });
  }

  const totalExpired = plan.reduce((sum, p) => sum + p.expired, 0);
  if (!args.apply) {
    console.log(`Dry run complete. ${totalExpired.toLocaleString()} documents would be removed.`);
    await mongoose.connection.close();
    return;
  }

  const proceed = await confirm(
    `Delete ${totalExpired.toLocaleString()} documents from animl-${stage} and add TTL indexes?`,
  );
  if (!proceed) {
    console.log('Aborted.');
    await mongoose.connection.close();
    return;
  }

  for (const p of plan) {
    console.log(`\n  ${p.name}`);
    if (args.ttlOnly) {
      console.log("    --ttl-only: leaving the backlog to MongoDB's TTL monitor");
    } else {
      await pruneBatched(p.collection, p.field, p.cutoff);
    }
    await ensureTtlIndex(p.collection, p.field, p.retentionDays);

    const after = await collectionStats(db, p.name);
    console.log(
      `    now ${after.count.toLocaleString()} docs, ` +
        `${GB(after.size)} GB data (was ${GB(p.stats.size)} GB)`,
    );
  }

  console.log('\nDone. Storage is reclaimed lazily by WiredTiger; run compact if you need');
  console.log('the disk back immediately, and expect the next snapshot to be smaller.');
  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
