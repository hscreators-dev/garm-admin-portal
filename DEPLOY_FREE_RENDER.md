# Garm — deploy LIVE for FREE (Render + MongoDB Atlas)

This gives you a **working** public site with **stable, named URLs** (e.g. `garm-shop.onrender.com`), for **free**, that runs 24/7 without your Mac. Two free accounts, ~30 minutes, no coding.

> Why not GitHub alone? GitHub Pages only serves the *frontend* — it can't run the backend or database, so login/orders/catalog wouldn't work. Render runs the backends; Atlas is the database; together they actually work.

**Push your latest code to both GitHub repos first** (GitHub Desktop → Commit → Push), so Render deploys the new version. Repos:
- Admin: `github.com/hscreators-dev/garm-admin-portal`
- Customer app: `github.com/hscreators-dev/Haneef`

---

## Part 1 — Database (MongoDB Atlas, free, ~10 min)
1. Sign up at **mongodb.com/cloud/atlas/register** (free).
2. Create a **free M0 cluster** (any region).
3. **Database Access** → Add New Database User → username + password → save it.
4. **Network Access** → Add IP Address → **Allow Access from Anywhere (0.0.0.0/0)** (needed so Render can connect).
5. **Connect → Drivers** → copy the connection string. It looks like:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
   **Add the database name** `garm` before the `?`:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/garm?retryWrites=true&w=majority`
   Keep this string handy — you'll paste it into Render twice.

## Part 2 — Backends on Render (2 free web services)
Sign in at **render.com** with your GitHub account.

**2a. Customer backend**
- New → **Web Service** → connect the **Haneef** repo.
- Root Directory: `backend`  ·  Runtime: **Docker**  ·  Instance Type: **Free**  ·  Name: `garm-app-backend`
- **Environment** (Add these):
  - `NODE_ENV` = `production`
  - `MONGODB_URI` = *(your Atlas string)*
  - `JWT_SECRET` = *(click "Generate")*
  - `SMTP_HOST`=`smtp.gmail.com` · `SMTP_PORT`=`587` · `SMTP_USER`=*(your gmail)* · `SMTP_PASS`=*(Gmail App Password)* · `EMAIL_FROM`=*(your gmail)*
- Create. Wait for it to go live. **Copy its URL** (e.g. `https://garm-app-backend.onrender.com`).

**2b. Admin backend**
- New → **Web Service** → connect the **garm-admin-portal** repo.
- Root Directory: `server`  ·  Runtime: **Docker**  ·  Instance: **Free**  ·  Name: `garm-admin-backend`
- **Environment**:
  - `NODE_ENV` = `production`
  - `MONGODB_URI` = *(the same Atlas string)*
  - `GARM_SECRET_KEY` = *(a 64-character hex — click Generate, then trim to 64 hex chars, or use any 64 hex)*
  - same `SMTP_*` values as above (so admin login emails work too)
- Create. **Copy its URL** (e.g. `https://garm-admin-backend.onrender.com`).

## Part 3 — Frontends on Render (2 free static sites)
**3a. Customer app**
- New → **Static Site** → connect the **Haneef** repo.
- Build Command: `npm install && npx vite build --base=/`
- Publish Directory: `dist`
- **Environment**:
  - `VITE_API_URL` = `https://garm-app-backend.onrender.com/api`   *(your 2a URL + `/api`)*
  - `VITE_ADMIN_API_URL` = `https://garm-admin-backend.onrender.com/api/garm`   *(your 2b URL + `/api/garm`)*
- Create. **Copy its URL** (e.g. `https://garm-shop.onrender.com`).

**3b. Admin portal**
- New → **Static Site** → connect the **garm-admin-portal** repo.
- Build Command: `npm install && npx vite build --base=/`
- Publish Directory: `dist`
- **Environment**: `VITE_API_URL` = `https://garm-admin-backend.onrender.com`   *(your 2b URL, no suffix)*
- Create. **Copy its URL** (e.g. `https://garm-admin.onrender.com`).

## Part 4 — Connect them (CORS)
Go back to the two **backends** → Environment, and set:
- On **garm-app-backend**: `FRONTEND_URL` = your customer-app URL (3a).
- On **garm-admin-backend**: `ALLOWED_ORIGINS` = `<customer-app URL>,<admin-app URL>` (3a,3b, comma-separated).
Save — each backend redeploys automatically.

## Done 🎉
- Customer app → your 3a URL (e.g. `https://garm-shop.onrender.com`)
- Admin portal → your 3b URL (e.g. `https://garm-admin.onrender.com`)

Log in with **haneef@garm.com** (admin) — the code arrives by **email** (that's what the SMTP settings are for). Everything shares your Atlas database.

**Notes**
- Free web services **sleep after 15 min idle**; the first visit then takes ~30–50 sec to wake. Normal for free.
- To change anything later, just **push to GitHub** — Render rebuilds automatically.
- No Gmail? Any SMTP works, or see `OTP_SETUP.md` for SMS/other email providers. Without an OTP method, production login can't send codes.

Tell me your four Render URLs once created and I'll double-check the env wiring for you.
