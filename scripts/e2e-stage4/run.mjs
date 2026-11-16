import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import crypto from 'node:crypto';

const root = process.cwd();
const backendCwd = path.join(root, 'backend');
const runId = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
// Dedicated Stage 4 isolated E2E ports. Can be overridden for conflict-free runs.
const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 3500);
const backendPort = Number(process.env.E2E_BACKEND_PORT || 5500);
const baseURL = `http://127.0.0.1:${frontendPort}`;
const backendURL = `http://127.0.0.1:${backendPort}`;

const E2E_ADMIN_USERNAME = 'e2e_admin_stage4';
const E2E_ADMIN_PASSWORD = `E2e!${crypto.randomBytes(6).toString('hex')}Aa1`;
const E2E_CUSTOMER_NAME = 'E2E Stage4 Customer';
const E2E_CUSTOMER_EMAIL = `e2e.stage4.${runId}@example.test`.toLowerCase();
const E2E_CUSTOMER_PASSWORD = `Cust!${crypto.randomBytes(6).toString('hex')}Aa1`;
// valid Indian mobile format required by custom cake form/API
const phoneSuffix = String(10000000 + (parseInt(crypto.randomBytes(3).toString('hex'), 16) % 89999999)).slice(0, 8);
const E2E_CUSTOMER_PHONE = `98${phoneSuffix}`;

const results = { safety: [], steps: [], playwright: null, files: [], db: { used: false, uriHost: null, dbName: null } };
let mongoProc = null, backendProc = null, frontendProc = null;
let mongoUri = null, dbName = null;
let capturedOrderNumber = '';
let capturedReference = '';
let abortedForSafety = false;

function log(msg) { console.log(`[e2e-stage4] ${msg}`); }
function safetyPass(msg) { results.safety.push({ ok: true, msg }); log(`SAFETY OK: ${msg}`); }
function safetyFail(msg) { results.safety.push({ ok: false, msg }); console.error(`[e2e-stage4] SAFETY FAIL: ${msg}`); abortedForSafety = true; throw new Error(`SAFETY_FAIL: ${msg}`); }

function readEnvFile(p) { try { return existsSync(p) ? readFileSync(p, 'utf8') : ''; } catch { return ''; } }
function collectForbiddenDbStrings() {
  const files = [
    path.join(root, '.env'),
    path.join(root, '.env.local'),
    path.join(root, '.env.development'),
    path.join(root, '.env.production'),
    path.join(backendCwd, '.env'),
    path.join(backendCwd, '.env.local'),
    path.join(backendCwd, '.env.development'),
    path.join(backendCwd, '.env.production'),
  ];
  const vals = [];
  for (const f of files) {
    const txt = readEnvFile(f);
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/i);
      if (m && m[1]) vals.push(m[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  }
  return vals.filter(Boolean);
}

function isForbiddenMongoUri(uri) {
  if (!uri) return 'empty URI';
  const l = uri.toLowerCase();
  if (l.includes('mongodb.net')) return 'contains mongodb.net (Atlas)';
  if (l.startsWith('mongodb+srv://')) return 'SRV/Atlas URI';
  if (l.includes('bluebell')) return 'contains production-like marker';
  return null;
}

function assertInheritedMongoEnvSafe() {
  const keys = [
    'MONGODB_URI',
    'MONGO_URI',
    'MONGO_URL',
    'MONGODB_URL',
    'DATABASE_URL',
    'DB_URI',
  ];
  for (const key of keys) {
    const val = process.env[key];
    if (!val) continue;
    const reason = isForbiddenMongoUri(String(val));
    if (reason) {
      safetyFail(`Inherited ${key} is forbidden (${reason}); isolated mongodb-memory-server must be the only backend database`);
    }
  }
  safetyPass('Inherited MongoDB environment variables contain no forbidden Atlas/production URIs');
}

function baseSystemEnv() {
  const allow = ['PATH','Path','SystemRoot','SYSTEMROOT','ComSpec','COMSPEC','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOME','HOMEPATH','HOMEDRIVE','PATHEXT','WINDIR','NUMBER_OF_PROCESSORS','OS','ProgramFiles','ProgramFiles(x86)','ProgramW6432','CommonProgramFiles','CommonProgramFiles(x86)'];
  const env = {};
  for (const k of allow) if (process.env[k] != null) env[k] = process.env[k];
  env.NODE_ENV = 'test';
  return env;
}

function waitForExit(proc, ms = 5000) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode != null || proc.signalCode != null) return resolve();
    const t = setTimeout(() => resolve(), ms);
    proc.once('exit', () => { clearTimeout(t); resolve(); });
  });
}

function assertPortFree(port, label) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.once('error', (err) => {
      if (err && err.code === 'EADDRINUSE') reject(new Error(`BLOCKER: required ${label} port ${port} is already in use`));
      else reject(new Error(`BLOCKER: unable to verify ${label} port ${port}: ${err?.message || err}`));
    });
    srv.listen(port, '127.0.0.1', () => {
      srv.close((closeErr) => {
        if (closeErr) reject(new Error(`BLOCKER: unable to release ${label} port ${port}: ${closeErr.message}`));
        else resolve();
      });
    });
  });
}

function taskkillTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve(false);
    try {
      const p = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      p.on('exit', (code) => resolve(code === 0));
      p.on('error', () => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

async function killProc(proc, name) {
  if (!proc) return true;
  if (proc.exitCode != null || proc.signalCode != null) {
    log(`stopped ${name} (pid=${proc.pid}, already exited)`);
    return true;
  }

  try { proc.kill('SIGTERM'); } catch {}
  await waitForExit(proc, 4000);

  if (proc.exitCode == null && proc.signalCode == null) {
    if (process.platform === 'win32') {
      await taskkillTree(proc.pid);
    } else {
      try { proc.kill('SIGKILL'); } catch {}
    }
    await waitForExit(proc, 5000);
  }

  if (proc.exitCode == null && proc.signalCode == null) {
    const msg = `failed to confirm ${name} exit (pid=${proc.pid}) after bounded shutdown`;
    console.error(`[e2e-stage4] ${msg}`);
    return false;
  }

  log(`stopped ${name} (pid=${proc.pid})`);
  return true;
}

function httpReady(url, timeoutMs = 120000, validate, requestTimeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, val) => { if (settled) return; settled = true; fn(val); };
    const tick = () => {
      if (settled) return;
      if (Date.now() - start > timeoutMs) return finish(reject, new Error(`Timeout waiting for ${url}`));
      const req = http.get(url, (res) => {
        const status = res.statusCode || 0;
        if (!validate) {
          if (status >= 200 && status < 500) {
            try { res.resume(); } catch {}
            try { req.destroy(); } catch {}
            return finish(resolve, { status, body: '' });
          }
          try { res.resume(); } catch {}
          setTimeout(tick, 1000);
          return;
        }
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          try {
            if (status >= 200 && status < 500 && validate(status, body)) {
              return finish(resolve, { status, body });
            }
          } catch {}
          setTimeout(tick, 1000);
        });
      });
      req.on('error', () => { if (!settled) setTimeout(tick, 1000); });
      req.setTimeout(requestTimeoutMs, () => { try { req.destroy(); } catch {}; if (!settled) setTimeout(tick, 1000); });
    };
    tick();
  });
}

function stringEnv(env){
  const out={};
  for (const [k,v] of Object.entries(env||{})){
    if (v===undefined || v===null) continue;
    out[k]=String(v);
  }
  return out;
}

const knownRunPids = new Set();
function trackRunPid(pid) {
  if (pid != null) knownRunPids.add(Number(pid));
}

function spawnLogged(cmd, args, opts, name) {
  const env = stringEnv(opts?.env);
  const baseOpts = { ...opts, env, stdio: ['ignore','pipe','pipe'] };
  let p;
  try {
    if (process.platform === 'win32') {
      const comspec = process.env.ComSpec || 'cmd.exe';
      const commandLine = [cmd, ...(args||[])].join(' ');
      console.log(`[e2e-stage4] spawn ${name}: ${commandLine}`);
      p = spawn(comspec, ['/d','/s','/c', commandLine], { ...baseOpts, windowsHide: true });
    } else {
      p = spawn(cmd, args||[], baseOpts);
    }
  } catch (e) {
    console.error('[e2e-stage4] spawn failed', name, e);
    throw e;
  }
  trackRunPid(p.pid);
  p.stdout.on('data', d => process.stdout.write(`[${name}] ${d}`));
  p.stderr.on('data', d => process.stderr.write(`[${name}] ${d}`));
  return p;
}

function runNodeScript(scriptPath, args, env, cwd, name, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [scriptPath, ...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    trackRunPid(p.pid);
    let out = '', err = '';
    p.stdout.on('data', d => { out += d.toString(); process.stdout.write(`[${name}] ${d}`); });
    p.stderr.on('data', d => { err += d.toString(); process.stderr.write(`[${name}] ${d}`); });
    const t = setTimeout(() => { try { p.kill(); } catch {} reject(new Error(`${name} timeout`)); }, timeoutMs);
    p.on('exit', (code) => { clearTimeout(t); if (code === 0) resolve({ out, err }); else reject(new Error(`${name} exited ${code}\n${err}\n${out}`)); });
  });
}

async function startMongo() {
  const forbidden = collectForbiddenDbStrings();
  log(`Loaded ${forbidden.length} repo MONGODB_URI value(s) for denylist checks`);

  // Defense-in-depth: inspect inherited MongoDB env vars before starting backend/DB flow.
  // The isolated mongodb-memory-server URI must be the only backend database connection.
  assertInheritedMongoEnvSafe();

  const env = { ...baseSystemEnv(), E2E_RUN_ID: runId };
  mongoProc = spawn(process.execPath, [path.join(root, 'scripts', 'e2e-stage4', 'mongo-server.mjs')], {
    cwd: backendCwd, env, stdio: ['ignore', 'pipe', 'pipe']
  });
  trackRunPid(mongoProc.pid);
  let buf = '';
  let resolved = false;
  const uriPromise = new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Timed out waiting for mongodb-memory-server URI')), 180000);
    mongoProc.stdout.on('data', (d) => {
      const s = d.toString();
      process.stdout.write(`[mongo] ${s}`);
      buf += s;
      if (resolved) return;
      const lines = buf.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          if (j && j.ok && j.uri) { resolved = true; clearTimeout(to); resolve(j); return; }
        } catch {}
      }
    });
    mongoProc.stderr.on('data', (d) => process.stderr.write(`[mongo] ${d}`));
    mongoProc.on('exit', (code) => { if (!resolved) { clearTimeout(to); reject(new Error(`mongo-server exited early (${code})`)); } });
  });
  const info = await uriPromise;
  mongoUri = info.uri;
  dbName = info.dbName;

  const reason = isForbiddenMongoUri(mongoUri);
  if (reason) safetyFail(`Memory server URI unsafe: ${reason}`);
  for (const f of forbidden) { if (f && mongoUri === f) safetyFail('Memory URI equals a repository .env MONGODB_URI'); }
  if (!dbName || dbName !== `e2e_stage4_${runId}`) safetyFail(`Unexpected isolated db name: ${dbName}`);
  results.db = { used: true, uriHost: (()=>{ try { return new URL(mongoUri.replace('mongodb://','http://')).host; } catch { return 'localhost'; } })(), dbName };
  safetyPass(`Using isolated mongodb-memory-server (${dbName})`);
  safetyPass('No Atlas/SRV/production/repo .env MongoDB URI in use');
  return info;
}

async function main() {
  log(`runId=${runId} frontend=${baseURL} backend=${backendURL}`);
  await startMongo();

  // Preflight: required fixed ports and env safety
  await assertPortFree(frontendPort, 'frontend');
  await assertPortFree(backendPort, 'backend');
  const forbiddenDb = collectForbiddenDbStrings();
  for (const f of forbiddenDb) { const r = isForbiddenMongoUri(f); if (!r) { /* repo may contain atlas; we just must not use it */ } }
  safetyPass('External services disabled by explicit blank env (Brevo/SMTP/Razorpay/Cloudinary/Google)');
  safetyPass('Harness does not inherit backend/.env or frontend env credentials (explicit env only)');

  const sharedTestSecrets = {
    JWT_SECRET: crypto.randomBytes(48).toString('hex'),
    OTP_SECRET: crypto.randomBytes(48).toString('hex'),
  };

  const backendEnv = {
    ...baseSystemEnv(),
    NODE_ENV: 'test',
    PORT: String(backendPort),
    CORS_ORIGIN: baseURL,
    MONGODB_URI: mongoUri,
    ...sharedTestSecrets,
    // disable/mask external integrations
    BREVO_API_KEY: '', BREVO_FROM_EMAIL: '', BREVO_FROM_NAME: 'E2E',
    BREVO_SMTP_HOST: '', BREVO_SMTP_PORT: '', BREVO_SMTP_USER: '', BREVO_SMTP_KEY: '',
    RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '', RAZORPAY_WEBHOOK_SECRET: '',
    CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
    GOOGLE_CLIENT_ID: '', NEXT_PUBLIC_GOOGLE_CLIENT_ID: '',
  };

  const frontendEnv = {
    ...baseSystemEnv(),
    NODE_ENV: 'production',
    PORT: String(frontendPort),
    BACKEND_INTERNAL_URL: backendURL,
    NEXT_PUBLIC_API_URL: backendURL,
    NEXT_PUBLIC_SITE_URL: baseURL,
    JWT_SECRET: sharedTestSecrets.JWT_SECRET,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: '',
    NEXT_DIST_DIR: '.next-e2e-stage4',
  };

  // seed
  const seedEnv = { ...baseSystemEnv(), E2E_MONGODB_URI: mongoUri, E2E_RUN_ID: runId, E2E_ADMIN_USERNAME, E2E_ADMIN_PASSWORD, E2E_CUSTOMER_EMAIL, E2E_CUSTOMER_PASSWORD, E2E_CUSTOMER_NAME, E2E_CUSTOMER_PHONE };
  await runNodeScript(path.join(root, 'scripts', 'e2e-stage4', 'db-seed.mjs'), [], seedEnv, backendCwd, 'seed', 120000);
  safetyPass('Seeded only minimum admin/customer test accounts in isolated DB');

  // start backend
  backendProc = spawnLogged('npm.cmd', ['run', 'dev'], { cwd: backendCwd, env: backendEnv }, 'backend');
  await httpReady(`${backendURL}/health`, 180000, (_s, body) => {
    try { const j = JSON.parse(body); return j && j.database === 'connected'; } catch { return false; }
  });
  if (backendProc.exitCode != null) throw new Error(`Backend exited early with code ${backendProc.exitCode}`);
  log('backend ready and connected to isolated DB');

  // start frontend (isolated Next.js production build + start in project root, isolated distDir)
  const e2eNextDistDir = '.next-e2e-stage4';
  frontendProc = spawnLogged(process.execPath, [path.join(root, 'scripts', 'e2e-stage4', 'next-dev-server.mjs')], {
    cwd: root,
    env: {
      ...frontendEnv,
      E2E_RUN_ID: runId,
      E2E_FRONTEND_PORT: String(frontendPort),
      E2E_FRONTEND_HOST: '127.0.0.1',
      E2E_NEXT_DIST_DIR: e2eNextDistDir,
    },
  }, 'frontend');
  await httpReady(`${baseURL}/`, 900000, (_s, body) => /bluebell/i.test(body || ''), 15000);
  if (frontendProc.exitCode != null) throw new Error(`Frontend exited early with code ${frontendProc.exitCode}`);
  log(`frontend ready (project-root production build, isolated distDir: ${e2eNextDistDir})`);

  // run playwright
  const pwConfig = process.env.E2E_PW_CONFIG || 'playwright.e2e.stage4.config.ts';
  const pwEnv = {
    ...baseSystemEnv(),
    E2E_BASE_URL: baseURL,
    E2E_RUN_ID: runId,
    E2E_ADMIN_USERNAME,
    E2E_ADMIN_PASSWORD,
    E2E_CUSTOMER_EMAIL,
    E2E_CUSTOMER_PASSWORD,
    E2E_CUSTOMER_NAME,
    E2E_CUSTOMER_PHONE,
  };
  mkdirSync(path.join(root, 'test-results'), { recursive: true });
  let pwCode = 0;
  await new Promise((resolve) => {
    let p;
    if (process.platform === 'win32') {
      const comspec = process.env.ComSpec || 'cmd.exe';
      const commandLine = `npx.cmd playwright test -c ${pwConfig} --reporter=list`;
      console.log(`[e2e-stage4] spawn playwright: ${commandLine}`);
      p = spawn(comspec, ['/d', '/s', '/c', commandLine], { cwd: root, env: stringEnv(pwEnv), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } else {
      p = spawn('npx', ['playwright', 'test', '-c', pwConfig, '--reporter=list'], { cwd: root, env: stringEnv(pwEnv), stdio: ['ignore', 'pipe', 'pipe'] });
    }
    trackRunPid(p.pid);
    p.stdout.on('data', d => {
      const s = d.toString();
      process.stdout.write(`[playwright] ${s}`);
      const m1 = s.match(/E2E_RESULT orderNumber=(SV-\d{8}-\d{4}) referenceNumber=(CC-\d+-\d+)/);
      if (m1) { capturedOrderNumber = m1[1]; capturedReference = m1[2]; }
    });
    p.stderr.on('data', d => process.stderr.write(`[playwright] ${d}`));
    p.on('exit', (code) => { pwCode = code ?? 1; resolve(); });
  });
  results.playwright = { exitCode: pwCode };

  if (pwCode !== 0) throw new Error(`Playwright failed with exit code ${pwCode}`);
}

function getProcessInfoWindows(pid) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !pid) return resolve(null);
    const ps = spawn('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}" -ErrorAction SilentlyContinue; if($p){ $p | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress }`,
    ], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let out = '';
    ps.stdout.on('data', (d) => { out += d.toString(); });
    ps.on('exit', () => {
      try {
        const j = JSON.parse(out.trim());
        resolve(j && j.ProcessId ? j : null);
      } catch { resolve(null); }
    });
    ps.on('error', () => resolve(null));
  });
}

async function isOwnedByThisRun(pid) {
  const target = Number(pid);
  if (!target) return false;
  if (knownRunPids.has(target)) return true;
  if (process.platform !== 'win32') return false;
  let current = target;
  for (let depth = 0; depth < 8; depth++) {
    const info = await getProcessInfoWindows(current);
    if (!info) return false;
    const ppid = Number(info.ParentProcessId);
    if (!ppid) return false;
    if (knownRunPids.has(ppid)) return true;
    if (ppid === current) return false;
    current = ppid;
  }
  return false;
}

function getListeningPidsWindows(port) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    const ps = spawn('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      `Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess`,
    ], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let out = '';
    ps.stdout.on('data', (d) => { out += d.toString(); });
    ps.on('exit', () => {
      const pids = out.split(/\r?\n/).map(s => Number(String(s).trim())).filter(n => Number.isFinite(n) && n > 0);
      resolve(Array.from(new Set(pids)));
    });
    ps.on('error', () => resolve([]));
  });
}

function getProcessSnapshotWindows() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    const ps = spawn('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      '$p=Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Select-Object ProcessId,ParentProcessId,CommandLine; if($p){ $p | ConvertTo-Json -Compress -Depth 4 }',
    ], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let out = '';
    ps.stdout.on('data', (d) => { out += d.toString(); });
    ps.on('exit', () => {
      try {
        const j = JSON.parse(out.trim());
        const arr = Array.isArray(j) ? j : (j ? [j] : []);
        resolve(arr.map(x => ({
          pid: Number(x.ProcessId),
          ppid: Number(x.ParentProcessId),
          cmd: String(x.CommandLine || ''),
        })).filter(x => Number.isFinite(x.pid) && x.pid > 0));
      } catch { resolve([]); }
    });
    ps.on('error', () => resolve([]));
  });
}

async function pidIsAliveWindows(pid) {
  const target = Number(pid);
  if (!target) return false;
  const snap = await getProcessSnapshotWindows();
  return snap.some(p => p.pid === target);
}

function hasExactExpectedFrontendCommand(cmd, port) {
  const raw = String(cmd || '').trim();
  const c = raw.toLowerCase();
  if (!c) return false;
  const wrapperPathA = 'scripts\\e2e-stage4\\next-dev-server.mjs';
  const wrapperPathB = 'scripts/e2e-stage4/next-dev-server.mjs';
  const nextBinA = '\\node_modules\\next\\dist\\bin\\next';
  const nextBinB = '/node_modules/next/dist/bin/next';
  if (c.includes(wrapperPathA) || c.includes(wrapperPathB)) {
    return c.includes('node') && (c.endsWith(wrapperPathA) || c.endsWith(wrapperPathB) || c.includes(`${wrapperPathA} `) || c.includes(`${wrapperPathB} `) || c.includes(wrapperPathA) || c.includes(wrapperPathB));
  }
  if (c.includes(' next start') || c.includes(nextBinA) || c.includes(nextBinB)) {
    return c.includes('node') &&
      c.includes(' start') &&
      c.includes(`-p ${Number(port)}`) &&
      c.includes('-h 127.0.0.1');
  }
  return false;
}

function getVerifiedFrontendProcessInfo(proc, rootPid, port) {
  const root = Number(rootPid);
  if (!proc || process.platform !== 'win32' || !root) return null;
  const pid = Number(proc.pid);
  const ppid = Number(proc.ppid);
  if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(ppid) || ppid <= 0) return null;
  if (!hasExactExpectedFrontendCommand(proc.cmd, port)) return null;
  return { pid, ppid, cmd: String(proc.cmd || ''), rootPid: root };
}

async function collectFrontendProcessCandidates(rootPid, port) {
  const root = Number(rootPid);
  if (process.platform !== 'win32' || !root) return [];
  const snap = await getProcessSnapshotWindows();
  if (snap.length === 0) return [];
  const byPid = new Map(snap.map(p => [p.pid, p]));
  const children = new Map();
  for (const p of snap) {
    if (!children.has(p.ppid)) children.set(p.ppid, []);
    children.get(p.ppid).push(p.pid);
  }
  const candidates = new Map();
  const queue = [root];
  const seen = new Set([root]);

  while (queue.length) {
    const cur = queue.shift();
    for (const childPid of (children.get(cur) || [])) {
      if (seen.has(childPid)) continue;
      seen.add(childPid);
      queue.push(childPid);
      const info = getVerifiedFrontendProcessInfo(byPid.get(childPid), root, port);
      if (info) candidates.set(info.pid, info);
    }
  }

  // Discover orphaned-but-potential candidates only when the process still records the tracked
  // frontend root PID as its parent. (If the original root exited, Windows may retain this PPID.)
  for (const p of snap) {
    if (candidates.has(p.pid)) continue;
    if (Number(p.ppid) !== root) continue;
    const info = getVerifiedFrontendProcessInfo(p, root, port);
    if (info) candidates.set(info.pid, info);
  }

  return Array.from(candidates.values());
}

function hasVerifiableFrontendAncestorRelationship(proc, rootPid, snapshotByPid) {
  const root = Number(rootPid);
  let cur = Number(proc?.ppid);
  if (!Number.isFinite(cur) || cur <= 0 || !root) return false;
  for (let depth = 0; depth < 8; depth++) {
    if (!cur) return false;
    if (cur === root) return true;
    const parent = snapshotByPid.get(cur);
    if (!parent) return false; // cannot positively prove ancestry to tracked root
    const next = Number(parent.ppid);
    if (!Number.isFinite(next) || next <= 0 || next === cur) return false;
    cur = next;
  }
  return false;
}

async function getIndependentlyVerifiedFrontendPids(rootPid, port) {
  const root = Number(rootPid);
  if (process.platform !== 'win32' || !root) return [];
  const candidates = await collectFrontendProcessCandidates(root, port);
  if (candidates.length === 0) return [];
  const snap = await getProcessSnapshotWindows();
  const byPid = new Map(snap.map(p => [p.pid, p]));
  const verified = [];
  for (const candidate of candidates) {
    const current = getVerifiedFrontendProcessInfo(byPid.get(candidate.pid), root, port);
    if (!current) continue; // command/port/host no longer exactly match
    if (!hasVerifiableFrontendAncestorRelationship(current, root, byPid)) continue;
    verified.push(current.pid);
  }
  return Array.from(new Set(verified));
}

async function waitForPidsExitWindows(pids, timeoutMs) {
  const targets = Array.from(new Set((pids || []).map(Number).filter(n => Number.isFinite(n) && n > 0)));
  if (process.platform !== 'win32' || targets.length === 0) return [];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await getProcessSnapshotWindows();
    const alive = new Set(snap.map(p => p.pid));
    const remaining = targets.filter(pid => alive.has(pid));
    if (remaining.length === 0) return [];
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  const snap = await getProcessSnapshotWindows();
  const alive = new Set(snap.map(p => p.pid));
  return targets.filter(pid => alive.has(pid));
}

async function ensureFrontendTreeStopped(frontendRootProc) {
  const rootPid = Number(frontendRootProc?.pid);
  if (process.platform !== 'win32' || !rootPid) return;

  let verified = await getIndependentlyVerifiedFrontendPids(rootPid, frontendPort);
  if (verified.length > 0) {
    log(`frontend cleanup: verified owned frontend candidate pid(s): ${verified.join(',')}`);
  }

  let remaining = await waitForPidsExitWindows(verified, 3000);
  if (remaining.length === 0) {
    // Re-verify to ensure no positively attributable wrapper/managed child remains.
    verified = await getIndependentlyVerifiedFrontendPids(rootPid, frontendPort);
    remaining = await waitForPidsExitWindows(verified, 1000);
  }

  if (remaining.length === 0) return;

  const unresolvedUnverifiedAlive = new Set();
  const failedAliveAfterTermination = new Set();

  for (const pid of remaining) {
    // Fresh snapshot before ownership verification/termination; if absent, it already exited
    // (including possible termination by a parent's taskkill /T /F).
    let snap = await getProcessSnapshotWindows();
    let byPid = new Map(snap.map(p => [p.pid, p]));
    if (!byPid.has(pid)) {
      continue;
    }

    let current = getVerifiedFrontendProcessInfo(byPid.get(pid), rootPid, frontendPort);
    if (!current || !hasVerifiableFrontendAncestorRelationship(current, rootPid, byPid)) {
      // Ownership cannot be positively verified; leave untouched and report as unresolved.
      snap = await getProcessSnapshotWindows();
      byPid = new Map(snap.map(p => [p.pid, p]));
      if (byPid.has(pid)) {
        unresolvedUnverifiedAlive.add(pid);
        console.error(`[e2e-stage4] cleanup failure: cannot positively verify ownership of frontend pid=${pid}; leaving untouched (unresolved)`);
      }
      continue;
    }

    // Re-check presence immediately before termination to avoid duplicate taskkill of a child
    // that may have already exited (e.g. via parent's taskkill /T /F).
    snap = await getProcessSnapshotWindows();
    byPid = new Map(snap.map(p => [p.pid, p]));
    if (!byPid.has(pid)) {
      continue;
    }
    current = getVerifiedFrontendProcessInfo(byPid.get(pid), rootPid, frontendPort);
    if (!current || !hasVerifiableFrontendAncestorRelationship(current, rootPid, byPid)) {
      if (byPid.has(pid)) {
        unresolvedUnverifiedAlive.add(pid);
        console.error(`[e2e-stage4] cleanup failure: cannot positively verify ownership of frontend pid=${pid}; leaving untouched (unresolved)`);
      }
      continue;
    }

    log(`frontend cleanup: terminating positively verified frontend pid=${pid} (wrapper/managed child still alive)`);
    const killResult = await taskkillPid(pid);

    // Actual process-presence verification after termination attempt.
    const afterKill = await waitForPidsExitWindows([pid], 5000);
    if (afterKill.length > 0) {
      failedAliveAfterTermination.add(pid);
      console.error(`[e2e-stage4] cleanup failure: positively verified frontend pid=${pid} did not confirm exit after termination`);
      if (!killResult.ok) {
        console.error(`[e2e-stage4] cleanup failure: taskkill did not report success for frontend pid=${pid} (exitCode=${killResult.code ?? 'unknown'})`);
      }
    } else if (!killResult.ok) {
      // PID exited despite non-zero taskkill status (possible race); termination is confirmed.
      log(`frontend cleanup: frontend pid=${pid} exited after termination (taskkill exitCode=${killResult.code ?? 'unknown'})`);
    }
  }

  // Final bounded re-check: do not claim success if any expected frontend candidate remains alive
  // but ownership cannot be verified (report unresolved and leave untouched), or if a verified
  // process remains alive.
  const finalVerified = await getIndependentlyVerifiedFrontendPids(rootPid, frontendPort);
  const finalVerifiedAlive = await waitForPidsExitWindows(finalVerified, 3000);

  const finalCandidates = await collectFrontendProcessCandidates(rootPid, frontendPort);
  const finalSnap = await getProcessSnapshotWindows();
  const finalByPid = new Map(finalSnap.map(p => [p.pid, p]));
  const finalVerifiedSet = new Set(finalVerified);
  const finalUnresolved = new Set(unresolvedUnverifiedAlive);
  for (const candidate of finalCandidates) {
    const current = getVerifiedFrontendProcessInfo(finalByPid.get(candidate.pid), rootPid, frontendPort);
    if (!current) continue;
    if (finalVerifiedSet.has(current.pid)) continue;
    // Expected frontend candidate remains alive but cannot be positively verified.
    finalUnresolved.add(current.pid);
  }

  for (const pid of finalUnresolved) {
    console.error(`[e2e-stage4] cleanup failure: expected frontend candidate pid=${pid} remains alive but ownership cannot be verified; leaving untouched (unresolved)`);
  }
  for (const pid of finalVerifiedAlive) {
    console.error(`[e2e-stage4] frontend cleanup: failed to confirm exit for positively verified frontend pid(s): ${pid}`);
  }
  for (const pid of failedAliveAfterTermination) {
    if (!finalVerifiedAlive.includes(pid)) {
      // ensure explicit failure visibility if still present in live state
      const snap = await getProcessSnapshotWindows();
      if (snap.some(p => p.pid === pid)) {
        console.error(`[e2e-stage4] cleanup failure: frontend pid=${pid} remains alive after termination attempt`);
      }
    }
  }

  if (finalVerifiedAlive.length === 0 && finalUnresolved.size === 0) {
    log('frontend cleanup: no positively verified or unresolved-alive expected frontend processes remain');
  } else {
    console.error('[e2e-stage4] frontend cleanup: completed with unresolved/unconfirmed frontend processes');
  }
}

function taskkillPid(pid) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve({ ok: true, skipped: true, code: null });
    const target = Number(pid);
    if (!Number.isFinite(target) || target <= 0) return resolve({ ok: false, skipped: false, code: null });
    try {
      const p = spawn('taskkill', ['/pid', String(target), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      p.on('exit', (code) => resolve({ ok: code === 0, skipped: false, code }));
      p.on('error', () => resolve({ ok: false, skipped: false, code: null }));
    } catch {
      resolve({ ok: false, skipped: false, code: null });
    }
  });
}

async function postCleanupVerify() {
  const e2eDistDir = path.join(root, '.next-e2e-stage4');
  try {
    // Best-effort verification: ports 3500/5500 should be free; only terminate
    // listeners whose ownership can be positively established from this run.
    for (const port of [frontendPort, backendPort]) {
      const pids = process.platform === 'win32' ? await getListeningPidsWindows(port) : [];
      for (const pid of pids) {
        if (await isOwnedByThisRun(pid)) {
          log(`post-cleanup: terminating run-owned listener pid=${pid} on port ${port}`);
          const killResult = await taskkillPid(pid);
          if (!killResult.ok) {
            console.error(`[e2e-stage4] cleanup failure: taskkill did not report success for run-owned listener pid=${pid} on port ${port} (exitCode=${killResult.code ?? 'unknown'})`);
          }
          const remainingOwned = await waitForPidsExitWindows([pid], 5000);
          if (remainingOwned.length > 0) {
            console.error(`[e2e-stage4] cleanup failure: run-owned listener pid=${pid} on port ${port} did not confirm exit after termination`);
          }
        } else {
          log(`post-cleanup: port ${port} still in use by non-run-owned pid=${pid}; leaving untouched`);
        }
      }
    }
    if (process.platform === 'win32') {
      // allow termination/port release to settle
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
      // Non-listening states (TIME_WAIT/FIN_WAIT/etc.) are not active listeners and must not
      // trigger process termination.
      for (const port of [frontendPort, backendPort]) {
        const remaining = await getListeningPidsWindows(port);
        if (remaining.length === 0) log(`post-cleanup: port ${port} has no LISTENING socket`);
        else log(`post-cleanup: port ${port} still has LISTENING pid(s): ${remaining.join(',')}`);
      }
    } else {
      for (const port of [frontendPort, backendPort]) {
        try { await assertPortFree(port, 'post-cleanup'); log(`post-cleanup: port ${port} is free`); }
        catch { log(`post-cleanup: port ${port} is not free`); }
      }
    }

    // Best-effort verification: isolated distDir must not remain.
    if (existsSync(e2eDistDir)) {
      log(`post-cleanup: ${e2eDistDir} still exists; attempting removal`);
      try { rmSync(e2eDistDir, { recursive: true, force: true }); } catch (e) { console.error('[e2e-stage4] post-cleanup distDir removal failed', e); }
    }
    if (existsSync(e2eDistDir)) {
      console.error(`[e2e-stage4] post-cleanup: isolated distDir still present: ${e2eDistDir}`);
    } else {
      log('post-cleanup: isolated .next-e2e-stage4 directory is clean');
    }
  } catch (e) {
    console.error('[e2e-stage4] post-cleanup verification failed', e);
  }
}

async function cleanup() {
  const frontendRootProc = frontendProc;
  try {
    await killProc(frontendProc, 'frontend');
  } catch {}
  try {
    // Bounded, ownership-safe verification: tracked frontend process exit alone is not enough
    // on Windows (cmd wrapper -> next-dev-server.mjs -> next start). Ensure attributed wrapper
    // and managed Next.js child processes have actually exited.
    await ensureFrontendTreeStopped(frontendRootProc);
  } catch (e) {
    console.error('[e2e-stage4] frontend cleanup verification failed', e);
  }
  try {
    await killProc(backendProc, 'backend');
  } catch {}
  try {
    if (mongoUri) {
      const cleanupEnv = { ...baseSystemEnv(), E2E_MONGODB_URI: mongoUri, E2E_RUN_ID: runId, E2E_ORDER_NUMBER: capturedOrderNumber, E2E_REQUEST_REF: capturedReference, E2E_CUSTOMER_EMAIL, E2E_ADMIN_USERNAME };
      await runNodeScript(path.join(root, 'scripts', 'e2e-stage4', 'db-cleanup.mjs'), [], cleanupEnv, backendCwd, 'cleanup', 120000).catch(e=>console.error(e));
    }
  } catch {}
  try {
    await killProc(mongoProc, 'mongo-memory-server');
  } catch {}
  try {
    const e2eTempBase = path.join(process.env.LOCALAPPDATA || process.env.TEMP || '', 'Temp', 'opencode');
    const e2eWorkspaceDir = path.join(e2eTempBase, `e2e-stage4-next-${runId}`);
    const e2eDistDir = path.join(root, '.next-e2e-stage4');
    const removeWithRetry = (target, label) => {
      for (let i = 0; i < 6; i++) {
        try {
          if (existsSync(target)) rmSync(target, { recursive: true, force: true });
          if (!existsSync(target)) { log(`removed ${label}: ${target}`); return; }
        } catch (e) {
          if (i === 5) console.error(`[e2e-stage4] failed to remove ${label}`, e);
        }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500);
      }
    };
    // Legacy temp workspace (dev-mode harness) if present for this run
    removeWithRetry(e2eWorkspaceDir, 'E2E temp workspace');
    // Only isolated artifact directory for this run's distDir; never touch normal .next
    removeWithRetry(e2eDistDir, 'E2E isolated distDir artifact');
  } catch (e) {
    console.error('[e2e-stage4] failed to remove E2E frontend artifacts', e);
  }
  await postCleanupVerify();
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error('[e2e-stage4] FAILED', err);
  } finally {
    await cleanup();
    const summaryPath = path.join(root, 'test-results', `stage4-e2e-summary-${runId}.json`);
    try { writeFileSync(summaryPath, JSON.stringify({ runId, abortedForSafety, results, capturedOrderNumber, capturedReference }, null, 2)); } catch {}
    log(`summary: ${summaryPath}`);
    if (abortedForSafety || (results.playwright && results.playwright.exitCode !== 0) || !results.playwright) process.exit(1);
    process.exit(0);
  }
})();
