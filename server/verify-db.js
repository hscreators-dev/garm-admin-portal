// ─── MongoDB connection verifier ──────────────────────────────────────────────
// Run this ONCE against your real database before (and after) deploying to
// confirm the backend can reach it. It's read-only — it never writes or wipes
// anything. Use YOUR Atlas connection string:
//
//     MONGODB_URI="mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/garm" node verify-db.js
//
// Keep the URI in your shell/.env — do NOT commit it. On success it prints the
// collections and how many documents each holds, so you can see the DB is live
// (empty counts at launch are NORMAL — see the note it prints).

import mongoose from 'mongoose';

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/garm';
const masked = URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'); // hide the password in logs

const EXPECTED = ['orders', 'supporttickets', 'users', 'quotes', 'counters'];

async function main() {
  console.log(`\n🔌 Connecting to: ${masked}\n`);
  const started = Date.now();
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    console.error(`❌ Could not connect (${Date.now() - started}ms): ${err.message}\n`);
    console.error('Common fixes:');
    console.error('  • Atlas → Network Access: add your server IP (or 0.0.0.0/0 to allow all while testing).');
    console.error('  • Atlas → Database Access: the DB user + password in the URI must be correct.');
    console.error('  • The URI must end with a database name, e.g. .../garm?retryWrites=true&w=majority');
    process.exit(1);
  }
  console.log(`✅ Connected in ${Date.now() - started}ms.`);

  const db = mongoose.connection.db;
  await db.admin().ping();
  console.log(`✅ Ping OK · database: "${db.databaseName}"\n`);

  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  console.log('Collections & document counts:');
  let anyData = false;
  for (const name of Array.from(new Set([...EXPECTED, ...existing]))) {
    if (!existing.includes(name)) { console.log(`  • ${name.padEnd(16)} — not created yet (fills on first use)`); continue; }
    const n = await db.collection(name).countDocuments();
    if (n > 0) anyData = true;
    console.log(`  • ${name.padEnd(16)} ${n} document(s)`);
  }

  console.log('\n' + (anyData
    ? '📦 The database already has data — you are live.'
    : '🆕 The database is empty — this is EXPECTED for a fresh launch.'));
  console.log('   Orders, tickets, customers and payments are created as real people');
  console.log('   use the app, so they start at 0. The product CATALOG the app shows');
  console.log('   comes from the admin backend (auto-seeded on first boot), not from');
  console.log('   this empty database — so the app still shows products on day one.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
