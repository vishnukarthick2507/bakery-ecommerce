import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const projectRoot = process.cwd();
const hostname = process.env.E2E_FRONTEND_HOST || '127.0.0.1';
const port = Number(process.env.E2E_FRONTEND_PORT || 3500);
const distDirName = process.env.E2E_NEXT_DIST_DIR || process.env.NEXT_DIST_DIR || '.next-e2e-stage4';
const backendUrl = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5500';

function fail(msg, err) {
  console.error(`[e2e-next-prod] ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function readFileState(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, content: null };
    return { exists: true, content: fs.readFileSync(filePath, 'utf8') };
  } catch (e) {
    fail(`Failed to snapshot file: ${filePath}`, e);
  }
}

function restoreFileState(filePath, state) {
  try {
    if (!state) return;
    if (!state.exists) {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
      return;
    }
    const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
    if (current !== state.content) fs.writeFileSync(filePath, state.content, 'utf8');
  } catch (e) {
    console.error(`[e2e-next-prod] warning: failed to restore ${filePath}`, e);
  }
}

function runToCompletion(cmd, args, opts, label) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    p.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`));
    p.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
    p.on('error', reject);
    p.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited code=${code} signal=${signal}`));
    });
  });
}

function waitForChildExit(proc, ms) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode != null || proc.signalCode != null) return resolve(true);
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      resolve(proc.exitCode != null || proc.signalCode != null);
    };
    const t = setTimeout(done, ms);
    proc.once('exit', done);
  });
}

function taskkillTree(pid) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !pid) return resolve(false);
    try {
      const tk = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      tk.on('exit', (code) => resolve(code === 0));
      tk.on('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

async function stopChild(proc, label = 'next-start') {
  if (!proc || proc.exitCode != null || proc.signalCode != null) {
    return { stopped: true, confirmed: true };
  }

  try { proc.kill('SIGTERM'); } catch {}
  await waitForChildExit(proc, 5000);
  if (proc.exitCode != null || proc.signalCode != null) {
    return { stopped: true, confirmed: true };
  }

  // Windows: bounded, targeted escalation for the managed child process tree.
  if (process.platform === 'win32') {
    await taskkillTree(proc.pid);
  } else {
    try { proc.kill('SIGKILL'); } catch {}
  }

  const confirmed = await waitForChildExit(proc, 5000);
  if (!confirmed) {
    console.error(`[e2e-next-prod] cleanup failure: ${label} (pid=${proc.pid}) did not confirm exit after bounded shutdown`);
    return { stopped: false, confirmed: false };
  }

  return { stopped: true, confirmed: true };
}

async function main() {
  if (!Number.isInteger(port) || port <= 0) fail(`Invalid E2E_FRONTEND_PORT: ${process.env.E2E_FRONTEND_PORT}`);
  if (!distDirName || distDirName === '.next' || distDirName.includes('..') || path.isAbsolute(distDirName)) {
    fail(`Unsafe or disallowed distDir: ${distDirName}`);
  }

  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  const nextEnvPath = path.join(projectRoot, 'next-env.d.ts');
  const tsconfigSnapshot = readFileState(tsconfigPath);
  const nextEnvSnapshot = readFileState(nextEnvPath);

  let child = null;
  let restoredAfterBuild = false;
  let finalRestoreDone = false;
  let shuttingDown = false;
  let shutdownPromise = null;

  const restoreConfigFiles = (reason) => {
    if (finalRestoreDone) return;
    finalRestoreDone = true;
    console.log(`[e2e-next-prod] restoring project config files (${reason})`);
    restoreFileState(tsconfigPath, tsconfigSnapshot);
    restoreFileState(nextEnvPath, nextEnvSnapshot);
  };

  const restoreAfterBuildMutations = () => {
    if (restoredAfterBuild) return;
    restoredAfterBuild = true;
    console.log('[e2e-next-prod] restoring tsconfig.json/next-env.d.ts after production build');
    restoreFileState(tsconfigPath, tsconfigSnapshot);
    restoreFileState(nextEnvPath, nextEnvSnapshot);
    // allow final defensive restore to run again on shutdown if anything changes unexpectedly
    finalRestoreDone = false;
  };

  const shutdown = (sig, exitCode = 0) => {
    if (shutdownPromise) return shutdownPromise;
    shuttingDown = true;
    shutdownPromise = (async () => {
      let childStop = { stopped: !child, confirmed: !child };
      try { console.log(`[e2e-next-prod] shutting down (${sig})`); } catch {}
      try {
        childStop = await stopChild(child, 'next-start');
      } catch (err) {
        console.error(`[e2e-next-prod] child shutdown handling failed (${sig})`, err);
        childStop = { stopped: false, confirmed: false };
      } finally {
        try { restoreConfigFiles(`shutdown:${sig}`); } catch {}
      }
      if (!childStop.confirmed) {
        console.error(`[e2e-next-prod] shutdown incomplete (${sig}): managed child process exit was not confirmed`);
      }
      process.exit(exitCode);
    })();
    return shutdownPromise;
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM', 0); });
  process.on('SIGINT', () => { void shutdown('SIGINT', 0); });
  process.on('uncaughtException', (err) => {
    console.error('[e2e-next-prod] uncaughtException', err);
    void shutdown('uncaughtException', 1);
  });
  process.on('unhandledRejection', (err) => {
    console.error('[e2e-next-prod] unhandledRejection', err);
    void shutdown('unhandledRejection', 1);
  });

  try {
    const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
    if (!fs.existsSync(nextBin)) fail(`Next binary not found at ${nextBin}`);

    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      NEXT_DIST_DIR: distDirName,
      BACKEND_INTERNAL_URL: backendUrl.replace(/\/+$/, ''),
      NEXT_PUBLIC_API_URL: backendUrl.replace(/\/+$/, ''),
    };

    console.log(JSON.stringify({
      ok: true,
      stage: 'build-start',
      mode: 'project-root-production',
      distDir: distDirName,
      url: `http://${hostname}:${port}`,
      backendUrl: env.BACKEND_INTERNAL_URL,
    }));

    console.log('[e2e-next-prod] building Next.js app (production, isolated distDir)...');
    await runToCompletion(process.execPath, [nextBin, 'build', '--webpack'], { cwd: projectRoot, env }, 'next-build');

    // Restore project config files mutated by build before serving
    restoreAfterBuildMutations();

    console.log('[e2e-next-prod] starting Next.js server (production)...');
    child = spawn(process.execPath, [nextBin, 'start', '-p', String(port), '-H', hostname], {
      cwd: projectRoot,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    child.stdout.on('data', (d) => process.stdout.write(`[next-start] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[next-start] ${d}`));
    child.on('exit', (code, signal) => {
      console.error(`[e2e-next-prod] next start exited code=${code} signal=${signal}`);
      if (shuttingDown) return;
      restoreConfigFiles('next-start-exit');
      process.exit(code == null ? 1 : code);
    });

    // keep process alive while child runs
  } catch (err) {
    console.error('[e2e-next-prod] startup/build error', err);
    let childStop = { stopped: !child, confirmed: !child };
    try {
      childStop = await stopChild(child, 'next-start');
    } catch (stopErr) {
      console.error('[e2e-next-prod] child cleanup failed after startup/build error', stopErr);
      childStop = { stopped: false, confirmed: false };
    } finally {
      try { restoreConfigFiles('error'); } catch {}
    }
    if (!childStop.confirmed) {
      console.error('[e2e-next-prod] startup/build cleanup incomplete: managed child process exit was not confirmed');
    }
    process.exit(1);
  }
}

main();
