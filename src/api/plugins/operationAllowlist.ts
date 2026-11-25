import { createHash } from 'node:crypto';
import { parse, print, type DocumentNode } from 'graphql';
import type { ApolloServerPlugin } from '@apollo/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { ForbiddenError } from '../errors.js';
import type { Context } from '../handler.js';

export type AllowlistMode = 'off' | 'log' | 'enforce';

export interface OperationManifest {
  version: number;
  operations: Record<string, { document: string; opKey?: string; lastSeen?: string }>;
}

interface AllowlistOptions {
  mode: AllowlistMode;
  loadManifest: () => Promise<OperationManifest>;
  ttlMs?: number;
  retryMs?: number;
  missRefreshMs?: number;
  now?: () => number;
}

// Callers on /internal authenticate with the API key and use their own fixed documents
const EXEMPT_RESOURCES = new Set(['/internal']);

export function parseMode(value: string | undefined): AllowlistMode {
  return value === 'log' || value === 'enforce' ? value : 'off';
}

export function hashDocument(document: DocumentNode): string {
  return createHash('sha256').update(print(document)).digest('hex');
}

// Throws on a malformed manifest so callers keep the last good allowlist instead of an empty one
export function buildAllowedHashes(manifest: OperationManifest): Set<string> {
  const operations = manifest?.operations;
  if (typeof operations !== 'object' || operations === null || Array.isArray(operations)) {
    throw new Error('operation allowlist: manifest has no operations object');
  }
  const allowed = new Set<string>();
  for (const [key, entry] of Object.entries(operations)) {
    try {
      allowed.add(hashDocument(parse(entry.document)));
    } catch (err) {
      console.error(`operation allowlist: skipping unparseable manifest entry ${key}`, err);
    }
  }
  if (Object.keys(operations).length > 0 && allowed.size === 0) {
    throw new Error('operation allowlist: no manifest entries could be parsed');
  }
  return allowed;
}

export function s3ManifestLoader(bucket: string, key = 'operation-manifest.json') {
  const s3 = new S3Client({ region: process.env.REGION });
  return async (): Promise<OperationManifest> => {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return JSON.parse(await res.Body!.transformToString());
  };
}

export function operationAllowlistPlugin({
  mode,
  loadManifest,
  ttlMs = 5 * 60 * 1000,
  retryMs = 30 * 1000,
  missRefreshMs = 30 * 1000,
  now = Date.now,
}: AllowlistOptions): ApolloServerPlugin<Context> {
  let allowed: Set<string> | null = null;
  let nextRefreshAt = 0;
  let lastAttemptAt = -Infinity;
  let inflight: Promise<void> | null = null;

  const refresh = async () => {
    lastAttemptAt = now();
    try {
      allowed = buildAllowedHashes(await loadManifest());
      nextRefreshAt = now() + ttlMs;
    } catch (err) {
      // Keep serving the last good manifest
      console.error('operation allowlist: failed to load manifest', err);
      nextRefreshAt = now() + retryMs;
    } finally {
      inflight = null;
    }
  };

  // onMiss: a frontend deploy may have added operations since the cached copy was loaded
  const getAllowed = async (onMiss = false) => {
    const due = now() >= nextRefreshAt || (onMiss && now() >= lastAttemptAt + missRefreshMs);
    if (due) {
      inflight ??= refresh();
      await inflight;
    }
    return allowed;
  };

  return {
    async requestDidStart() {
      if (mode === 'off') return;

      return {
        async didResolveOperation({ contextValue, document, operationName }) {
          if (EXEMPT_RESOURCES.has(contextValue.resource)) return;

          const hash = hashDocument(document);
          let allowedHashes = await getAllowed();
          if (allowedHashes?.has(hash)) return;
          allowedHashes = await getAllowed(true);
          if (allowedHashes?.has(hash)) return;

          console.warn(
            JSON.stringify({
              message: 'operation_not_allowlisted',
              mode,
              reason: allowedHashes ? 'unknown_operation' : 'manifest_unavailable',
              hash,
              operationName,
              resource: contextValue.resource,
              sub: contextValue.user?.sub,
              project: contextValue.user?.curr_project,
              userAgent:
                contextValue.headers?.['User-Agent'] ?? contextValue.headers?.['user-agent'],
            }),
          );

          if (mode === 'enforce') {
            throw new ForbiddenError('Operation not permitted', { http: { status: 403 } });
          }
        },
      };
    },
  };
}
