import path from 'node:path';
import { createRequire } from 'node:module';

const backendCwd = process.cwd();
const require = createRequire(path.join(backendCwd, 'package.json'));
const { MongoMemoryReplSet } = require('mongodb-memory-server');

function fail(msg) {
  console.error(`[e2e-mongo] SAFETY FAIL: ${msg}`);
  process.exit(1);
}

const runId = process.env.E2E_RUN_ID || '';
if (!runId) fail('E2E_RUN_ID is required');

(async () => {
  let replset;
  let shuttingDown = false;

  const shutdown = async (signal = 'SIGTERM') => {
    if (shuttingDown) return;
    shuttingDown = true;
    let exitCode = 0;
    try {
      if (replset) {
        // Bounded stop of the isolated in-memory replica set (and its mongod member).
        await replset.stop({ doCleanup: true, force: false });
      }
    } catch (err) {
      exitCode = 1;
      console.error(`[e2e-mongo] cleanup failure: failed to stop mongodb-memory-server replica set (${signal})`, err);
    } finally {
      process.exit(exitCode);
    }
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  try {
    const dbName = `e2e_stage4_${runId}`;
    // Single-node replica set for isolated E2E: supports transactions (required by app logic)
    // while preserving dynamic port allocation and the existing isolated db name/URI contract.
    replset = await MongoMemoryReplSet.create({
      replSet: { count: 1, dbName },
    });

    const uri = replset.getUri(dbName);

    const lower = String(uri || '').toLowerCase();
    if (!uri) fail('MongoMemoryReplSet returned empty URI');
    if (lower.includes('mongodb.net') || lower.startsWith('mongodb+srv://')) fail('Refusing SRV/Atlas URI');
    if (lower.includes('bluebell') || lower.includes('prod')) fail('Refusing suspicious production-like URI');
    if (!uri.includes(dbName)) fail('Memory URI does not include isolated db name');
    if (!/[\?&]replicaSet=/.test(uri)) fail('Memory URI is not a replica-set connection string (transactions unsupported)');

    process.stdout.write(JSON.stringify({ ok: true, uri, dbName, runId }) + '\n');

    // Keep process alive until harness signals shutdown.
    setInterval(() => {}, 1 << 30);
  } catch (err) {
    console.error('[e2e-mongo] failed to start mongodb-memory-server replica set', err);
    try {
      if (replset) await replset.stop({ doCleanup: true, force: false });
    } catch {}
    process.exit(1);
  }
})();
