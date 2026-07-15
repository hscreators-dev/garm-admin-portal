# Test Today — Get Both Apps Live (15 minutes, ₹0)

Everything is already committed on your machine. Only YOU can push (GitHub needs
your login). Then a few clicks in Render.

---

## Step 1 — Push both repos (Terminal on your Mac)

```bash
cd "/Users/haneefm/Downloads/11/Garm app admin portal" && git push origin main
cd "/Users/haneefm/Downloads/11/Latest version of FAB" && git push origin main
```

Your GitHub repos (recovered — save these):
- Garm App:      https://github.com/hscreators-dev/Haneef
- Admin Portal:  https://github.com/hscreators-dev/garm-admin-portal

Render auto-deploys on push (if it doesn't, open each service → **Manual Deploy ▸ Deploy latest commit**).

---

## Step 2 — Turn on on-screen login codes (FREE, no email/SMS account)

The push includes a new switch: `ALLOW_DEV_OTP`. When on, the login code is
shown **on the screen itself** — no email needed. This is why OTP "never came":
in production the code is hidden unless a real email gateway is configured.

In https://dashboard.render.com:

1. **garm-admin-backend** → Environment → Add:
   - `ALLOW_DEV_OTP` = `true`
   - `SUPER_ADMIN_EMAIL` = `hscreators@gmail.com`  (lets you log in with your own email)
2. **garm-app-backend** → Environment → Add:
   - `ALLOW_DEV_OTP` = `true`
3. Save → each service redeploys automatically.

⚠️ While this is on, anyone who knows an email can see its code. Fine for
testing today — turn it off (delete the var) once real email is wired.

---

## Step 3 — Check garm-app-backend is actually running

Right now it answers nothing (the admin backend is healthy, this one is not).
In Render open **garm-app-backend** → check:

- Status should be "Live". If it crashed, open **Logs** — the usual cause is a
  missing `MONGODB_URI`. Copy the SAME Atlas connection string from
  garm-admin-backend's Environment into garm-app-backend.
- If the service doesn't exist at all: New ▸ Blueprint ▸ pick the **Haneef**
  repo ▸ Apply (render.yaml creates backend + frontend together).

Health check when done: https://garm-app-backend.onrender.com/health → `{"status":"ok"...}`

---

## Step 4 — Make sure the frontends point at the backends

The two static sites bake these values in at build time. Check they're set
(Render → service → Environment), then redeploy the static site if you change them:

**garm-shop** (customer app):
- `VITE_API_URL`       = `https://garm-app-backend.onrender.com/api`
- `VITE_ADMIN_API_URL` = `https://garm-admin-backend.onrender.com/api/garm`

**garm-admin** (admin portal):
- `VITE_API_URL` = `https://garm-admin-backend.onrender.com`

**garm-admin-backend**:
- `ALLOWED_ORIGINS` = `https://garm-shop.onrender.com,https://garm-admin.onrender.com`

---

## Step 5 — Test

1. https://garm-admin.onrender.com → enter your email → the code appears on screen → log in.
2. https://garm-shop.onrender.com → sign in the same way → place an order.
3. Admin portal → Orders → your order appears (same FL-xxxx number) → Accept & Confirm.
4. Garm app → Track → popup "Order confirmed" → Pay → admin sees payment.

Note: free Render services sleep after 15 min idle — the FIRST request takes
~50 seconds to wake up. That's normal on the free plan, not a bug.

---

## Later (optional, still free): real email codes

Gmail App Password (free): Google Account → Security → 2-Step Verification →
App passwords → create one. Then on BOTH backends set:
- `SMTP_HOST` = `smtp.gmail.com`, `SMTP_PORT` = `587`
- `SMTP_USER` = `hscreators@gmail.com`, `SMTP_PASS` = the app password
- `EMAIL_FROM` = `hscreators@gmail.com`

Then delete `ALLOW_DEV_OTP` — codes arrive by real email.
