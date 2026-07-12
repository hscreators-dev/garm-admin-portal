# Garm — Deployment Guide

Both apps are code-complete and build clean. This gets them **live**. I can't run the deploy for you (it needs your server, domain, MongoDB and secrets — only you hold those), but everything below is turnkey.

The stack: **MongoDB** + **2 backends** (customer API :4000, admin API :5050) + **2 frontends** (customer app, admin portal). Both frontends and backends share one MongoDB.

---

## Option A — One box with Docker (simplest, ~15 min)

Everything (Mongo + both backends + both frontends) runs with one command. Works on any VPS (Hetzner, DigitalOcean, EC2, etc.) or locally.

**1. Put the two project folders side by side** (they already are):
```
11/
├── Garm app admin portal/     ← run compose from here
└── Latest version of FAB/
```

**2. Generate secrets & fill the env:**
```bash
cd "Garm app admin portal"
cp .env.deploy.example .env
# generate the two required secrets:
echo "JWT_SECRET=$(openssl rand -base64 48)"      >> .env   # or paste into .env
echo "GARM_SECRET_KEY=$(openssl rand -hex 32)"    >> .env
# then edit .env: set CUSTOMER_APP_URL / ADMIN_APP_URL and your OTP gateway.
```

**3. Launch:**
```bash
docker compose up -d --build
```

**4. Open:**
- Customer app → `http://<server-ip>:8080`
- Admin portal → `http://<server-ip>:8081/garm-admin-portal/`

**5. Put HTTPS in front.** Point a reverse proxy (Caddy is easiest — auto-TLS) or your cloud load balancer at ports 8080 / 8081 and map your domains. Example Caddyfile:
```
app.yourdomain.com   { reverse_proxy localhost:8080 }
admin.yourdomain.com { reverse_proxy localhost:8081 }
```

That's it — the customer app proxies `/api` → customer backend and `/admin-api` → admin backend internally, so there are no CORS issues.

---

## Option B — Managed platforms (no server to manage)

Free/cheap tiers, git-based. Roughly:

1. **MongoDB Atlas** — create a free M0 cluster, copy the connection string → this is your `MONGODB_URI`.
2. **Backends → Render / Railway / Fly.io** (two Node services):
   - Customer backend: root `Latest version of FAB/backend`, build `npm install && npm run build`, start `node dist/index.js`. Env: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, OTP + payment vars.
   - Admin backend: root `Garm app admin portal/server`, build `npm install`, start `node index.js`. Env: `NODE_ENV=production`, `MONGODB_URI`, `GARM_SECRET_KEY`, `ALLOWED_ORIGINS`, OTP vars, and a persistent disk mounted with `DB_FILE=/data/db.json`.
3. **Frontends → Vercel / Netlify** (two static sites):
   - Customer app: build `npm run build`, output `dist`. Env at build: `VITE_API_URL=https://<customer-backend-url>/api`, `VITE_ADMIN_API_URL=https://<admin-backend-url>/api/garm`.
   - Admin portal: build `npm run build`, output `dist`. Env: `VITE_API_URL=https://<admin-backend-url>`.
   - Set each backend's CORS (`FRONTEND_URL` / `ALLOWED_ORIGINS`) to the deployed frontend URLs.

---

## Before you flip it live — the launch checklist

| Must-do | Why |
|---|---|
| `JWT_SECRET` (32+) and `GARM_SECRET_KEY` (64 hex) set | Servers **refuse to boot in production** without them (by design). |
| `MONGODB_URI` points at your real DB | Orders/quotes live here. |
| OTP gateway configured (`SMS_PROVIDER`/`SMTP_*`) | Otherwise **no one can log in** (prod won't leak codes). See `OTP_SETUP.md`. |
| `ALLOWED_ORIGINS` / `FRONTEND_URL` = your real domains | CORS will block the app otherwise. |
| Decide payments: keep `PAYMENTS_REQUIRE_GATEWAY=false` (pay via coordinator) or wire Razorpay/Stripe | Prod **blocks self-asserted "paid"** — customers can't pay online until a gateway is wired. |
| HTTPS in front of everything | Never serve OTP/PII over plain HTTP. |
| Native push (optional): `npm install @capacitor/local-notifications && npx cap sync` | For app-killed push; web/local fallback works without it. |

**Recommended:** soft-launch with `PAYMENTS_REQUIRE_GATEWAY=false` (coordinator collects payment) while you complete Razorpay/Stripe onboarding, then flip it on.

---

## Verified before shipping
- All three projects type-check clean (0 errors).
- Customer backend builds to `dist/` successfully.
- Security hardening in place (see `SECURITY_REVIEW.md`): auth gates, no mass-assignment, no OTP leak, encrypted PII (non-destructive), doc-upload allow-list, payment guard.
- The frontend production build (`vite build`) runs on a normal machine; it could not be exercised in the review sandbox only because the platform-specific rollup binary can't be installed there — a sandbox limitation, not a code issue.
