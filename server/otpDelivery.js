// ─── OTP delivery — your own, provider-agnostic (no Twilio lock-in) ───────────
// Delivers the verification code over EMAIL and SMS using plain HTTPS calls
// (Node's built-in fetch — no extra npm dependency, keeps this server
// dependency-free). You point it at whatever gateway you want via env vars, so
// you're never tied to a single paid vendor.
//
// EMAIL  → set EMAIL_API_URL (+ EMAIL_API_KEY). Works with any transactional
//          email HTTP API (Resend, Brevo, Mailgun, SendGrid) or your OWN relay.
//          Contract for the "generic" provider: POST JSON
//          { to, subject, html, text, from } with `Authorization: Bearer <key>`.
//
// SMS    → set SMS_API_URL (+ SMS_API_KEY). Works with any SMS gateway
//          (MSG91, Fast2SMS, your own relay). Contract for "generic": POST JSON
//          { to, message, code } with `Authorization: Bearer <key>`. Presets for
//          `msg91` and `fast2sms` are built in — set SMS_PROVIDER to pick one.
//
// If a channel isn't configured, delivery is skipped and the caller keeps the
// dev behaviour (code logged + echoed as devCode in non-production only). So
// nothing breaks before you wire a gateway — it just can't send yet.

const APP_NAME = process.env.OTP_APP_NAME || 'Garm';
const EXPIRES = process.env.OTP_EXPIRES_MINUTES || '10';

function otpText(code) {
  return `Your ${APP_NAME} verification code is ${code}. Valid for ${EXPIRES} minutes. Do not share this code with anyone.`;
}

function otpHtml(code) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#F8F7F5;border-radius:16px;">
    <h2 style="margin:0 0 8px;color:#0D0D0D;font-size:20px;font-weight:700;">Your ${APP_NAME} verification code</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;line-height:1.6;">Use the code below to sign in. It expires in <strong>${EXPIRES} minutes</strong>.</p>
    <div style="background:#fff;border:1px solid rgba(0,0,0,0.08);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="margin:0;font-size:34px;font-weight:700;letter-spacing:10px;color:#0D0D0D;font-family:monospace;">${code}</p>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">If you didn't request this, you can ignore this email. Never share this code with anyone.</p>
  </div>`;
}

// Normalise a phone to E.164. Bare 10-digit numbers get the default country
// code (India +91 by default; override with OTP_DEFAULT_COUNTRY_CODE).
function normalizePhone(raw) {
  const cc = (process.env.OTP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '');
  const s = String(raw || '').trim();
  const digits = s.replace(/\D/g, '');
  if (s.startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+' + cc + digits;
  return '+' + digits;
}

async function postJson(url, body, headers) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const txt = await r.text().catch(() => '');
  if (!r.ok) throw new Error(`gateway ${r.status}: ${txt.slice(0, 200)}`);
  return txt;
}

// ── EMAIL ─────────────────────────────────────────────────────────────────────
let _smtp = null;
async function smtpSend(to, code) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;
  if (!_smtp) {
    const nodemailer = (await import('nodemailer')).default;
    _smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_PORT) === '465',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  await _smtp.sendMail({
    from: `"${APP_NAME}" <${from}>`, to,
    subject: `${code} — Your ${APP_NAME} code`, html: otpHtml(code), text: otpText(code),
  });
  return { delivered: true, channel: 'email' };
}

async function sendEmail(to, code) {
  // Prefer SMTP (Gmail / any host) when configured — same SMTP_* vars the app
  // backend uses, so one email setup covers BOTH backends.
  if (process.env.SMTP_HOST) return smtpSend(to, code);
  const url = process.env.EMAIL_API_URL;
  if (!url) return { delivered: false, reason: 'no SMTP_HOST and no EMAIL_API_URL set' };
  const from = process.env.EMAIL_FROM || `no-reply@${APP_NAME.toLowerCase()}.app`;
  const key = process.env.EMAIL_API_KEY;
  const provider = (process.env.EMAIL_PROVIDER || 'generic').toLowerCase();

  let body;
  if (provider === 'resend') {
    body = { from, to: [to], subject: `${code} — Your ${APP_NAME} code`, html: otpHtml(code), text: otpText(code) };
  } else if (provider === 'brevo') {
    body = { sender: { email: from, name: APP_NAME }, to: [{ email: to }], subject: `${code} — Your ${APP_NAME} code`, htmlContent: otpHtml(code), textContent: otpText(code) };
  } else {
    // generic / your own relay
    body = { to, from, subject: `${code} — Your ${APP_NAME} code`, html: otpHtml(code), text: otpText(code) };
  }
  const headers = provider === 'brevo'
    ? { 'api-key': key || '' }
    : { Authorization: `Bearer ${key || ''}` };
  await postJson(url, body, headers);
  return { delivered: true, channel: 'email' };
}

// ── SMS ─────────────────────────────────────────────────────────────────────
async function sendSms(to, code) {
  const url = process.env.SMS_API_URL;
  const provider = (process.env.SMS_PROVIDER || 'generic').toLowerCase();
  const key = process.env.SMS_API_KEY;
  const toNorm = normalizePhone(to);
  const message = otpText(code);

  if (provider === 'msg91') {
    // MSG91 OTP flow API — needs SMS_API_URL=https://control.msg91.com/api/v5/otp
    const sender = process.env.SMS_SENDER || APP_NAME.slice(0, 6).toUpperCase();
    await postJson(url || 'https://control.msg91.com/api/v5/otp',
      { mobile: toNorm.replace('+', ''), otp: code, sender },
      { authkey: key || '' });
    return { delivered: true, channel: 'sms' };
  }
  if (provider === 'fast2sms') {
    // Fast2SMS OTP route
    const r = await fetch((url || 'https://www.fast2sms.com/dev/bulkV2'), {
      method: 'POST',
      headers: { authorization: key || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'otp', variables_values: code, numbers: toNorm.replace('+91', '').replace('+', '') }),
    });
    if (!r.ok) throw new Error(`fast2sms ${r.status}`);
    return { delivered: true, channel: 'sms' };
  }
  // generic / your own relay
  if (!url) return { delivered: false, reason: 'SMS_API_URL not set' };
  await postJson(url, { to: toNorm, message, code }, { Authorization: `Bearer ${key || ''}` });
  return { delivered: true, channel: 'sms' };
}

/**
 * Deliver an OTP over the requested channel. Returns { delivered, channel?, reason? }.
 * NEVER throws in a way that blocks login — the caller decides how to surface a
 * failed send (in dev it still echoes the code; in prod it should error).
 */
export async function deliverOtp({ identity, mode, code }) {
  try {
    if (mode === 'email') return await sendEmail(identity, code);
    return await sendSms(identity, code);
  } catch (err) {
    return { delivered: false, reason: err.message || 'delivery failed' };
  }
}
