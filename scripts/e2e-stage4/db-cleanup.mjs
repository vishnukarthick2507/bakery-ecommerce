import path from 'node:path';
import { createRequire } from 'node:module';

const backendCwd = process.cwd();
const require = createRequire(path.join(backendCwd, 'package.json'));
const mongoose = require('mongoose');

const uri = process.env.E2E_MONGODB_URI;
const runId = process.env.E2E_RUN_ID;
const ref = process.env.E2E_REQUEST_REF || '';
const orderNumber = process.env.E2E_ORDER_NUMBER || '';
const customerEmail = (process.env.E2E_CUSTOMER_EMAIL || '').toLowerCase();

if (!uri) process.exit(0);
const lower = uri.toLowerCase();
if (lower.includes('mongodb.net') || lower.startsWith('mongodb+srv://')) process.exit(0);

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  if (runId && dbName === `e2e_stage4_${runId}`) {
    await db.dropDatabase();
    console.log(JSON.stringify({ ok: true, droppedDb: dbName }));
  } else if (dbName && dbName.startsWith('e2e_stage4_')) {
    const ops = [];
    if (ref) ops.push(db.collection('customcakerequests').deleteMany({ referenceNumber: ref }));
    if (orderNumber) ops.push(db.collection('orders').deleteMany({ orderNumber }));
    if (customerEmail) ops.push(db.collection('users').deleteMany({ email: customerEmail }));
    ops.push(db.collection('admins').deleteMany({ username: process.env.E2E_ADMIN_USERNAME || 'e2e_admin_stage4' }));
    await Promise.all(ops);
    console.log(JSON.stringify({ ok: true, cleanedDb: dbName, targeted: true }));
  } else {
    console.log(JSON.stringify({ ok: false, skipped: 'unsafe_db_name', dbName }));
  }
  await mongoose.disconnect();
} catch (err) {
  console.error('[e2e-cleanup] failed', err);
  try { await mongoose.disconnect(); } catch {}
}
