# Garm — MongoDB for the live backend

## ⭐ You do NOT need to learn or set up MongoDB
The easiest path bundles MongoDB for you. The `docker-compose.yml` in this folder runs **its own MongoDB automatically** alongside the backends — you never sign up for anything, never create a database, never touch a connection string. It just works, and your data is saved in a Docker volume that survives restarts.

**The entire live stack in 3 steps** (on any server or your own computer with Docker installed):
```bash
cd "Garm app admin portal"
cp .env.deploy.example .env      # fill in JWT_SECRET + GARM_SECRET_KEY (the file tells you the commands)
docker compose up -d --build
```
That's it. MongoDB, both backends, and both frontends all start together — MongoDB included, zero database knowledge required. Open:
- Customer app → `http://<your-server>:8080`
- Admin portal → `http://<your-server>:8081/garm-admin-portal/`

The two secrets are generated with one command each (shown inside `.env.deploy.example`): `openssl rand -base64 48` for `JWT_SECRET` and `openssl rand -hex 32` for `GARM_SECRET_KEY`. Nothing MongoDB-related to configure.

> **Only use MongoDB Atlas if** you're deploying to a platform that can't run `docker compose` (e.g. Vercel + a separate Node host). Then follow the Atlas section below. Otherwise, ignore it — the Docker path already gives you a real, persistent MongoDB.

---

## (Optional) Using MongoDB Atlas instead
I **cannot** log into your MongoDB Atlas account or run commands against your cluster — that needs your credentials, and it's your account to control. If you go this route, here's the setup, plus a one-command tool to prove the connection works.

## "If the database is empty, how does it work?"
An empty MongoDB at launch is **normal and correct**. Here's why the app still works on day one:

- **Orders, support tickets, customers, payments** live in MongoDB. They start at **0** and fill up automatically as real people sign up and order. You don't pre-fill these — real usage creates them.
- **The product catalog** (categories + products the customer browses) does **not** come from MongoDB. It comes from the **admin backend's own store**, which **auto-seeds on first boot** with 12 categories and ~121 products. So even against a brand-new empty MongoDB, the app immediately shows products, and customers can order — those orders then land in MongoDB.

So: empty Mongo = no orders yet, but a **fully stocked catalog** and a working app. As soon as the first customer orders, you'll see it in the admin Orders page (and in Mongo).

## Go-live steps (do these with YOUR values)

1. **Create the cluster** in MongoDB Atlas (the free M0 tier is fine to start). Create a database user (username + password) under **Database Access**.
2. **Network Access** → add your server's IP. While testing you can temporarily allow `0.0.0.0/0` (all IPs), then lock it down.
3. **Copy the connection string** (Atlas → Connect → Drivers). It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/garm?retryWrites=true&w=majority
   ```
   Make sure it ends with a database name (`/garm`).
4. **Set it in each backend's `.env`** (both point at the SAME database so the app and admin share data):
   - `Latest version of FAB/backend/.env` → `MONGODB_URI=...`
   - the admin backend's environment → `MONGODB_URI=...`
5. **Verify the connection** before trusting it — from the admin `server/` folder:
   ```bash
   MONGODB_URI="your-atlas-uri" npm run verify-db
   ```
   It's read-only. You'll get a clear ✅/❌ and, on success, the collection counts (0s are expected on a fresh DB). On failure it tells you exactly what to fix (IP allow-list, user/password, missing DB name).
6. **Start the backends.** On boot the admin logs `Catalog ready: 12 categories, 121 products…` — that confirms the app has products to show even with an empty Mongo.

## Where each thing is stored (quick map)
| Data | Stored in | Empty at launch? |
|---|---|---|
| Orders, quotes | MongoDB (`orders`, `quotes`) | Yes — fills from real orders |
| Support tickets & returns | MongoDB (`supporttickets`) | Yes — fills from real tickets |
| Customers (app sign-ups) | MongoDB (`users`) | Yes — fills as people sign up |
| Product catalog, categories | Admin store (auto-seeded) | **No — seeded with ~121 products** |
| Admin settings, employees, coordinator, fees | Admin store | **No — seeded with defaults** |

## One thing to decide for production
The admin store (catalog/settings) persists to a file (`db.json`). On a host with **ephemeral storage** (e.g. Render's free tier without a disk), that file resets to the seed on every redeploy — you'd keep the default catalog but lose admin **edits**. Two options:
- **Attach a persistent disk/volume** and point `DB_FILE` at it (the included `docker-compose.yml` already does this) — simplest.
- Or ask me to **move the catalog into MongoDB too**, so absolutely everything lives in one database. This is a larger change but makes the admin store survive any redeploy. Say the word and I'll do it.

## Backups
Atlas takes automatic backups on paid tiers. On free M0, use `mongodump` periodically:
```bash
mongodump --uri="your-atlas-uri" --out=./backup-$(date +%F)
```
