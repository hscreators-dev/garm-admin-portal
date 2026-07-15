# Real OTP — what's free, what's paid, and the 5-minute setup

## The honest answer

| Channel | Cost | Verdict |
|---|---|---|
| **Email OTP** (Gmail SMTP) | **FREE** — 500 emails/day | ✅ Set it up (below) |
| **SMS OTP** (MSG91 / Fast2SMS / Twilio) | **PAID** (~₹0.15–0.25 per SMS + DLT registration in India) | ❌ Skip for now — mobile login keeps the on-screen dev code |

Real users can sign in with **email** and get a real emailed code. That's a
perfectly normal production login. Add SMS later only if you want it.

---

## Email OTP setup (one time, free)

**Step 1 — Create a Gmail App Password** (2 min, on your phone or Mac):
1. Go to https://myaccount.google.com/apppasswords
   (if it asks, first enable 2-Step Verification under Security).
2. App name: `Garm` → **Create**.
3. Google shows a 16-character password like `abcd efgh ijkl mnop`. Copy it
   (remove the spaces when pasting).

**Step 2 — Add it to BOTH Render backends** (dashboard.render.com):

On **garm-admin-backend** AND **garm-app-backend** → Environment:

| Key | Value |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` (already set — just verify it says exactly this) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `hscreators@gmail.com` |
| `SMTP_PASS` | *(the 16-char app password — this is the missing one!)* |
| `EMAIL_FROM` | `hscreators@gmail.com` |

Save → both services redeploy (~3 min).

**Step 3 — Test**: log in on https://garm-admin.onrender.com with your email.
The code should arrive in your Gmail inbox within seconds.

**Step 4 — Once email works**: delete `ALLOW_DEV_OTP` from both backends.
From then on codes are ONLY delivered by email (secure for real users).
Mobile-number login will still show the on-screen dev code until you add a
paid SMS gateway — that's fine for now.

> Why OTP was "not received" before: `SMTP_PASS` was never set, so the server
> could not log in to Gmail to send anything — and (before today's fix) it hung
> for minutes trying. Now it fails fast and falls back to the on-screen code,
> and once you add the app password it sends for real.

## Local (your Mac)

Local runs in dev mode — the code always shows on screen, no email needed.
If you want real emails locally too, add the same SMTP_* lines to
`Latest version of FAB/backend/.env`.
