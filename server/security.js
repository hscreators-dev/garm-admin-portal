// Security primitives shared by store.js and index.js — encryption at rest,
// token/OTP hashing, and a tiny in-memory rate limiter. All built on Node's
// built-in `crypto` module (no dependencies), consistent with the rest of
// this backend.
//
// What this does and doesn't do — read this before assuming more than it says:
// - Encrypts sensitive fields (name/phone/email/address/payment metadata) at
//   REST, i.e. inside server/db.json on disk. If that file is copied or
//   stolen, the sensitive fields are unreadable without the server's key.
// - Stores session tokens and OTP codes as one-way hashes, never raw, so a
//   stolen db.json can't be replayed as a valid login or a valid OTP.
// - Does NOT provide "end-to-end encryption" in the strict sense (only the
//   two conversation endpoints can decrypt) — this server itself can still
//   read the data once loaded into memory, because admin staff legitimately
//   need to read customer names/addresses/orders to do their jobs. True E2EE
//   would make that impossible. This is standard "encryption in transit +
//   at rest" instead, which is the correct model for an operations backend.
// - Transit encryption (HTTPS/TLS) has to happen in front of this process —
//   Node's plain `http` module here doesn't terminate TLS. Put this behind a
//   reverse proxy / hosting platform that provides HTTPS before it's public
//   (see the "Before this goes live" checklist in server/README.md).

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEY_FILE = path.join(__dirname, '.server-secret');
const ENC_PREFIX = 'enc:v1:';

function loadOrCreateKey() {
  const envKey = process.env.GARM_SECRET_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, 'hex');
    if (buf.length === 32) return buf;
    console.warn('[security] GARM_SECRET_KEY is set but is not 64 hex chars (32 bytes) — ignoring it and falling back to the local dev key file.');
  }
  // Production MUST use an externally-managed key. A locally-generated key file
  // is a dev convenience only — in prod it would silently make encrypted PII
  // unrecoverable across deploys and weaken the guarantee. Fail fast instead.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL] GARM_SECRET_KEY (64 hex chars) must be set in production — generate with `openssl rand -hex 32` and store it in a secret manager.');
  }
  if (fs.existsSync(KEY_FILE)) {
    const hex = fs.readFileSync(KEY_FILE, 'utf8').trim();
    const buf = Buffer.from(hex, 'hex');
    if (buf.length === 32) return buf;
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 });
  console.warn(
    '[security] Generated a new local encryption key at server/.server-secret (dev-only convenience).\n' +
    '           Set GARM_SECRET_KEY in production and manage it in a real secret manager —\n' +
    '           NEVER commit server/.server-secret, and never lose the key: encrypted data\n' +
    '           cannot be recovered without it.'
  );
  return key;
}

const KEY = loadOrCreateKey();

/** Encrypt a single scalar value (string/number) for storage. Empty/null passes through unchanged. */
export function encryptValue(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  // Idempotent: an already-encrypted value is returned unchanged. This is what
  // makes a key mismatch NON-destructive — if decrypt failed and preserved the
  // ciphertext, re-saving writes the same ciphertext back instead of mangling it.
  if (typeof plain === 'string' && plain.startsWith(ENC_PREFIX)) return plain;
  const str = String(plain);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/** Decrypt a value produced by encryptValue. Non-encrypted (legacy plaintext) values pass through unchanged. */
export function decryptValue(value) {
  if (typeof value !== 'string' || !value.startsWith(ENC_PREFIX)) return value;
  try {
    const raw = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Wrong key, corrupted data, or tampering. PRESERVE the ciphertext instead
    // of returning null — combined with encryptValue's idempotency, a boot with
    // the wrong key can no longer DESTROY the data on the next save (previously
    // it nulled the field and persisted the null). When the correct key returns,
    // the value decrypts normally.
    return value;
  }
}

export function encryptFields(obj, fields) {
  if (!obj) return obj;
  const out = { ...obj };
  for (const f of fields) if (out[f] !== undefined) out[f] = encryptValue(out[f]);
  return out;
}
export function decryptFields(obj, fields) {
  if (!obj) return obj;
  const out = { ...obj };
  for (const f of fields) if (out[f] !== undefined) out[f] = decryptValue(out[f]);
  return out;
}

/** One-way hash for tokens/OTP codes — we only ever need to compare, never recover the original. */
export function hashSecret(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

/** Constant-time string compare (both inputs are fixed-length hex hashes here, so length always matches). */
export function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---- Tiny in-memory rate limiter (fixed window) ----
const buckets = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) { b = { count: 0, resetAt: now + windowMs }; buckets.set(key, b); }
  b.count++;
  if (b.count > max) return { allowed: false, retryAfterMs: b.resetAt - now };
  return { allowed: true };
}
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}, 5 * 60 * 1000);
cleanupTimer.unref?.();
