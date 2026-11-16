import path from 'node:path';
import { createRequire } from 'node:module';

const backendCwd = process.cwd();
const require = createRequire(path.join(backendCwd, 'package.json'));
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

function fail(msg) {
  console.error(`[e2e-seed] ${msg}`);
  process.exit(1);
}

const uri = process.env.E2E_MONGODB_URI;
const runId = process.env.E2E_RUN_ID;
const adminUsername = process.env.E2E_ADMIN_USERNAME;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;
const customerName = process.env.E2E_CUSTOMER_NAME;
const customerPhone = process.env.E2E_CUSTOMER_PHONE;

if (!uri || !runId || !adminUsername || !adminPassword || !customerEmail || !customerPassword || !customerName || !customerPhone) {
  fail('Missing required E2E seed environment variables');
}

const lower = uri.toLowerCase();
if (lower.includes('mongodb.net') || lower.startsWith('mongodb+srv://')) fail('Refusing Atlas/SRV URI');

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  if (dbName !== `e2e_stage4_${runId}`) fail(`Unexpected database name: ${dbName}`);

  const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    passwordHash: String,
    googleId: String,
    emailVerified: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
  }, { timestamps: true, strict: false });
  const adminSchema = new mongoose.Schema({
    username: String,
    password: String,
    role: { type: String, default: 'ADMIN' },
    tokenVersion: { type: Number, default: 0 },
  }, { timestamps: true, strict: false });

  const User = mongoose.models.E2EUser || mongoose.model('E2EUser', userSchema, 'users');
  const Admin = mongoose.models.E2EAdmin || mongoose.model('E2EAdmin', adminSchema, 'admins');

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const customerPasswordHash = await bcrypt.hash(customerPassword, 10);

  await Admin.updateOne(
    { username: adminUsername },
    { $set: { username: adminUsername, password: adminPasswordHash, role: 'ADMIN', tokenVersion: 0 } },
    { upsert: true }
  );

  await User.updateOne(
    { email: customerEmail.toLowerCase() },
    { $set: { name: customerName, email: customerEmail.toLowerCase(), phone: customerPhone, passwordHash: customerPasswordHash, active: true, tokenVersion: 0, emailVerified: true } },
    { upsert: true }
  );

  const admin = await Admin.findOne({ username: adminUsername }).lean();
  const user = await User.findOne({ email: customerEmail.toLowerCase() }).lean();
  if (!admin || !user) fail('Seed verification failed');

  console.log(JSON.stringify({ ok: true, dbName, adminId: String(admin._id), userId: String(user._id), customerPhone }));
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error('[e2e-seed] failed', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
}
