# Garm — Own OTP Delivery (SMS + Email), no Twilio lock-in

You asked: *can we build our own OTP API instead of paying for Twilio?*

**Straight answer:**
- **Email OTP — yes, 100% your own and free.** Your server sends the code itself over SMTP (Gmail or any mail server) or a free-tier email HTTP API. No paid product needed.
- **SMS OTP — you still need *an* SMS gateway.** No server can push SMS into the phone network by itself — that's carrier infrastructure. But you are **not** tied to Twilio: both backends now use a **provider-agnostic adapter**, so you plug in any gateway (MSG91, Fast2SMS, AWS SNS, or *your own relay*) with env vars — no code changes. Use a cheap/free-tier Indian provider and you avoid Twilio's pricing entirely.

Onboarding already accepts **mobile number OR email**; the channel is auto-detected (an `@` → email, else phone) and the code is delivered on that channel.

---

## What changed in the code

- **Garm App backend** (`Latest version of FAB/backend`): `services/smsService.ts` is now provider-agnostic; `services/emailService.ts` works with any SMTP host (not just Gmail) and falls back to a console log in dev.
- **Admin Portal backend** (`Garm app admin portal/server`): new `otpDelivery.js` (dependency-free, uses built-in `fetch`) delivers admin + customer OTPs. Both `send-otp` routes now actually send.
- **Security:** the real code is **never** returned in API responses in production (only logged/echoed in dev). If a gateway is down in production, the endpoint returns a 502 instead of issuing a code nobody receives.

---

## Configure it (environment variables)

Set these in each backend's `.env`. With **nothing set**, dev logs the code to the console so you can still test.

### Email (pick ONE)

**A. Your own / any SMTP server (Garm App backend — recommended, free):**
```
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_SECURE=false          # true if port 465
SMTP_USER=apikey-or-username
SMTP_PASS=secret
EMAIL_FROM=no-reply@yourdomain.com
EMAIL_FROM_NAME=Garm
```
Gmail shortcut: `GMAIL_USER=you@gmail.com` + `GMAIL_APP_PASSWORD=…` (a Google "App Password").

**B. Email HTTP API (Admin backend — dependency-free):**
```
EMAIL_PROVIDER=resend        # resend | brevo | generic
EMAIL_API_URL=https://api.resend.com/emails
EMAIL_API_KEY=your_key
EMAIL_FROM=no-reply@yourdomain.com
```
Resend / Brevo / Mailgun / SendGrid all have free tiers and are a single HTTPS POST. Or point `EMAIL_API_URL` at **your own relay** (`generic`): it receives `POST {to, from, subject, html, text}` with `Authorization: Bearer <EMAIL_API_KEY>`.

### SMS (pick a provider)

```
SMS_PROVIDER=http            # console | http | msg91 | fast2sms | twilio
SMS_API_URL=https://your-relay.example.com/send
SMS_API_KEY=your_key
SMS_SENDER=GARM              # brand/sender id where required
OTP_DEFAULT_COUNTRY_CODE=91  # bare 10-digit numbers get this prefix
```
- **`http` = your own API** (recommended for full control): your endpoint receives `POST {to, message, code}` with `Authorization: Bearer <SMS_API_KEY>`. Build a 20-line relay behind it that forwards to whatever carrier/aggregator you sign up with — swap providers without touching the app.
- **`msg91`** / **`fast2sms`**: built-in presets for those Indian gateways (cheap, OTP-specific routes). Just set `SMS_API_KEY` (+ `SMS_SENDER` for MSG91).
- **`twilio`**: still supported if you ever want it (`TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`) — loaded only on demand, so the package isn't required otherwise.
- **`console`**: dev default — prints the code to the server log.

### Shared
```
OTP_APP_NAME=Garm
OTP_EXPIRES_MINUTES=10
NODE_ENV=production          # in prod: code is never returned in the API response
```

---

## The "build your own SMS relay" option (cheapest, most control)

If you want a single endpoint you own that every app talks to:

1. Stand up a tiny service (Node/Python, ~20 lines) exposing `POST /send` that reads `{to, message}` + a Bearer key.
2. Inside it, call whichever carrier/aggregator you've contracted (or rotate between several).
3. Point both backends at it: `SMS_PROVIDER=http`, `SMS_API_URL=https://your-relay/…`, `SMS_API_KEY=…`.

Now Garm never knows or cares who the SMS carrier is — you swap them freely, and there's no Twilio dependency anywhere.

---

## Verified

- Delivery layer unit-tested: phone normalised to E.164 (`9876543210 → +919876543210`), correct JSON posted to the SMS and email endpoints.
- End-to-end boot test: customer `send-otp` (phone → SMS gateway, email → email gateway) and admin `send-otp` (email gateway) all delivered to a mock "own API".
- Production safety: the code is never echoed in API responses when `NODE_ENV=production`.
