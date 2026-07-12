# Garm — put it LIVE on one server (step by step)

You chose the simplest path: one small cloud server runs the exact Docker setup you tested locally (MongoDB + both backends + both apps). Follow these in order.

---

## ⚠️ STEP 0 — Push your latest code to GitHub (do this first!)
Everything we built this session lives **only on your Mac right now**. The server pulls the code **from GitHub**, so if you skip this, the live site gets the OLD version without any of the new features.

You have two repos to push:
- `Garm app admin portal` → `github.com/hscreators-dev/garm-admin-portal`
- `Latest version of FAB`  → `github.com/hscreators-dev/Haneef`

**Easiest way — GitHub Desktop (no commands):**
1. Install **GitHub Desktop**: https://desktop.github.com/ and sign in.
2. File → **Add Local Repository** → choose the `Garm app admin portal` folder.
3. Bottom-left: type a summary like "Deploy build", click **Commit to main**, then **Push origin**.
4. Repeat: **Add Local Repository** → the `Latest version of FAB` folder → Commit → Push.

*(Command-line alternative, run inside EACH folder:)*
```bash
git add -A && git commit -m "Deploy build" && git push origin main
```
Your secrets are safe — `.env`, `.server-secret`, and `db.json` are git-ignored and will NOT be uploaded.

---

## STEP 1 — Rent a small server (~5 min, ~$5–6/month)
Any of these work; pick one and create an **Ubuntu 24.04** server with at least **2 GB RAM**:
- **DigitalOcean** — "Droplet", Ubuntu 24.04, Basic $6/mo. https://www.digitalocean.com/
- **Hetzner Cloud** — "CX22", Ubuntu 24.04, ~€4/mo. https://www.hetzner.com/cloud
- **Linode/Vultr** — similar.

During setup, choose a **password** (or SSH key) — you'll need it to log in. Note the server's **IP address** at the end.

## STEP 2 — Log into the server
On your Mac, open **Terminal** and run (replace with your server's IP):
```bash
ssh root@YOUR_SERVER_IP
```
Type `yes` if asked, then the password.

## STEP 3 — Run ONE command
Paste this and press Enter. It installs Docker, downloads both repos, and starts everything:
```bash
curl -fsSL https://raw.githubusercontent.com/hscreators-dev/garm-admin-portal/main/server-deploy.sh | bash
```
First run takes a few minutes (it's building the apps). When it finishes it prints your live links.

## STEP 4 — Open your live site 🎉
- Customer app → `http://YOUR_SERVER_IP:8080`
- Admin portal → `http://YOUR_SERVER_IP:8081/garm-admin-portal/`

Log in as **haneef@garm.com** (admin). In this preview mode the code shows on screen. It's live on the internet, with its own database.

**To update later** (after you push new code to GitHub):
```bash
ssh root@YOUR_SERVER_IP
cd /opt/garm/garm-admin-portal && git pull && docker compose up -d --build
```

---

## STEP 5 — Before you let REAL customers in
Preview mode is for you to test. For real customers, do these three things:

1. **Turn on secure login.** Edit `/opt/garm/garm-admin-portal/.env`:
   - change `NODE_ENV=development` → `NODE_ENV=production`
   - add an OTP delivery method so codes are actually sent (see `OTP_SETUP.md`). Easiest & free is **email via Gmail**: add
     ```
     SMTP_HOST=smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=youraddress@gmail.com
     SMTP_PASS=your-16-char-Google-App-Password
     EMAIL_FROM=youraddress@gmail.com
     ```
     (A "Google App Password" is generated in your Google account → Security → App passwords.)
   - Then: `docker compose up -d` to apply.
   > In production the code is **never** shown on screen — it's emailed/SMS'd. Without an OTP method set, login is blocked on purpose.

2. **Add your domain + HTTPS** (so it's `https://app.yourshop.com`, not an IP). Point your domain's DNS to the server IP, then install Caddy for automatic HTTPS:
   ```bash
   apt install -y caddy
   ```
   Put this in `/etc/caddy/Caddyfile` (replace the domains):
   ```
   app.yourshop.com   { reverse_proxy localhost:8080 }
   admin.yourshop.com { reverse_proxy localhost:8081 }
   ```
   Then `systemctl restart caddy`. Update `CUSTOMER_APP_URL` / `ADMIN_APP_URL` in `.env` to the `https://` domains and `docker compose up -d`.

3. **Payments** (optional now): the demo checkout is off in production. To take real money, wire Razorpay/Stripe — see `DEPLOY.md` (M1). Until then, collect payment via your coordinator.

---

## Quick help
- **Stop the site:** `cd /opt/garm/garm-admin-portal && docker compose down`
- **Start again:** `docker compose up -d`
- **See logs:** `docker compose logs -f`
- Your data lives in Docker volumes on the server and survives restarts.

Tell me your server IP or domain when you're at Step 4/5 and I'll help you finish HTTPS + email login.
