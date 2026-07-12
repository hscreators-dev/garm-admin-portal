# Garm Admin Backend

Real backend for the admin portal — REST API + live push, so admin actions
(catalog changes, order status updates) reach the Garm customer app instantly,
and customer orders reach the admin dashboard instantly.

## Two backends, one Orders/Quotes database — read this first

There are two separate Node processes involved in this product, and it's easy
to mix them up:

1. **This server** (`Garm app admin portal/server`) — the admin portal's API.
   Catalog, manufacturers, settings, employees, and admin/employee auth all
   live in its own local file store (`server/db.json`), just like before.
2. **`Latest version of FAB/backend`** — the Garm customer app's *real* own
   backend (Express + MongoDB, port 4000 by default). This is what the Garm
   App on a phone/browser actually talks to when a customer places an order,
   requests an OTP, or checks their tracker. It is a completely separate
   codebase and process from this one.

**Orders and Quotes are the one thing both processes now share.** Instead of
this admin server keeping its own separate copy (which is what caused orders
placed in the Garm App to never show up here), it connects directly to the
**same MongoDB database** as `Latest version of FAB/backend` (see
`server/mongo.js`) and reads/writes the `orders`/`quotes`/`users` collections
straight out of it. An order placed in the Garm App is a MongoDB document the
instant it's created — this admin server just queries it, live, with no sync
step, no polling, no webhook in between.

Practically, this means: **`MONGODB_URI` here must point at the exact same
database** as `Latest version of FAB/backend`'s own `.env` (both default to
`mongodb://localhost:27017/garm`, so if neither has been changed, no
configuration is needed — just make sure that MongoDB instance is running).
If you change one, change the other.

Everything else (categories/products/manufacturers/settings/employees/track-
stage copy/customer OTP sessions for the legacy `/api/garm/*` routes below)
is unaffected and still lives in this server's own `server/db.json`.

**Not zero-dependency anymore for Orders/Quotes.** This server used to be pure
Node.js with no `npm install` step. That's still true for everything except
Orders/Quotes, which need `mongoose` to talk to MongoDB — run `npm install`
once in `server/` before starting it.

## Run it

```bash
cd server
npm install           # needed now, for mongoose (Orders/Quotes -> MongoDB)
npm run dev            # starts on http://localhost:5050, auto-restarts on file changes
```

Make sure a MongoDB instance is reachable at `MONGODB_URI` (defaults to
`mongodb://localhost:27017/garm`) — the same one `Latest version of FAB/backend`
uses. If Mongo isn't reachable, the server still starts (catalog/settings/
employees keep working), but every `/api/orders` and `/api/garm/orders|quotes|track`
request will fail with a clear error until it is.

To verify the real end-to-end loop: place an order in the Garm App
(`Latest version of FAB`, talking to its own backend on port 4000) and confirm
it appears on this admin portal's Orders page — no refresh needed, it comes in
live via the SSE push stream once you've also wired `order:created`-style
notifications, or simply reload the Orders table to see it queried fresh from Mongo.

`npm run simulate` (below) still works for a **manual** admin-side order (the
"Log Manual Order" flow) — it does NOT simulate a Garm App customer order,
since those now only originate from the app's own backend.

```bash
npm run simulate               # places one random manual test order (Individuals or Organizations)
npm run simulate -- --type=B2B # force an Organizations order
```

Other scripts:
```bash
npm run seed:reset    # wipes server/db.json back to the original seed data (catalog/settings/employees only — Orders/Quotes live in MongoDB and are untouched by this)
```

**"My Super Admin login isn't working"** — `server/db.json` is only generated
from `server/seed.js` the *first* time the server runs; once it exists, editing
`seed.js` has no effect on it. If seed accounts (e.g. `haneef@garm.com`) were
changed after `db.json` already existed on your machine, run
`npm run seed:reset` (or delete `server/db.json` and restart) to pick up the
new seed data.

## Data

Catalog/settings/employees persist to `server/db.json` (created on first run
from `seed.js`) — a plain JSON file, open it directly to inspect state, or
delete it and restart the server to reseed.

**Orders and Quotes persist to MongoDB**, not `db.json` — see the section
above. `server/mongo.js` defines the Mongoose schemas (mirroring
`Latest version of FAB/backend/src/models/Order.ts` and `Quote.ts` field-for-
field, plus the admin-only operational fields — `adminStatus`, `manufacturer`,
`qcResult`, `adminPayStatus`, `total`, `lines`, `seq` — that were added
additively onto that same shared `Order` model). `server/store.js`'s
`listOrders`/`getOrder`/`createOrder`/`updateOrderStatus`/etc. are all `async`
now and query Mongo directly.

## REST API

| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| GET    | `/api/health`                 | liveness check |
| GET    | `/api/catalog/:audience/categories`  | `:audience` is `b2c` or `b2b` — Individuals and Organizations are separate catalogs (separate tables, separate ids; see "Access control model" below), never one shared list |
| POST   | `/api/catalog/:audience/categories`  | `{ name, image, description }` |
| PUT    | `/api/catalog/:audience/categories/:id` | |
| DELETE | `/api/catalog/:audience/categories/:id` | fails with 409 if products in that same catalog still reference it |
| GET    | `/api/catalog/:audience/products`    | |
| POST   | `/api/catalog/:audience/products`    | `{ name, categoryId, price, sizes[], colors[], moq, status, image }` |
| PUT    | `/api/catalog/:audience/products/:id` | |
| PATCH  | `/api/catalog/:audience/products/:id/status` | `{ status: 'ACTIVE'\|'INACTIVE' }` |
| GET    | `/api/manufacturers`          | |
| PUT    | `/api/manufacturers/:id`      | |
| GET    | `/api/orders`                 | reads from MongoDB — every order placed in the real Garm App shows up here, plus any manual admin-logged orders |
| GET    | `/api/orders/:id`             | |
| POST   | `/api/orders`                 | **admin-side "Log Manual Order" only** — real Garm App orders now come from its own backend (`Latest version of FAB/backend`, port 4000), not this endpoint. `{ cust, type: 'B2B'\|'B2C', email, address, lines: [{p, size, color, qty, unit}] }` |
| PUT    | `/api/orders/:id/status`      | admin updates — `{ status?, qc?, pay?, mfr? }`. Also updates the customer-facing `status`/`trackSteps` on the same Mongo document, so the Garm App's own tracker moves too |
| POST   | `/api/dev/reset`              | dev only — resets to seed data |
| GET    | `/api/users`                  | list all provisioned admin users |
| GET    | `/api/users/by-email/:email`  | look up a user by email (URL-encoded) — the admin app's sign-in check. 404 if no account exists |
| POST   | `/api/users`                  | Super Admin provisions a new employee — `{ name, email, role, status? }`. 409 if the email already exists |
| PUT    | `/api/users/:id`              | update name / role / status (`Active`, `Invited`, `Disabled`) |
| DELETE | `/api/users/:id`              | remove a user |

`image` fields accept base64 data URLs (`data:image/png;base64,...`) directly —
that's what the admin's file upload inputs send. No S3/storage service wired
up yet; swap for real object storage before production (images currently live
inside `db.json`, fine for a dev demo, not for scale).

## Live push (instead of WebSocket/Socket.io)

Also dependency-free: **Server-Sent Events**, read by the browser's native
`EventSource` — no `socket.io-client` needed on the frontend either.

Connect: `GET /api/events` (keeps the connection open, one event per line).

Events emitted, matching `GARM_APP_INTEGRATION.md`'s naming:

- `order:created` — full order object. Emit this from the Garm App the moment
  a customer places an order; the admin Dashboard shows it instantly.
- `order:status_changed` — full order object, whenever admin changes status/QC/payment/manufacturer.
- `category:created`, `category:updated`, `category:deleted`
- `product:created`, `product:updated`, `product:deactivated`
- `manufacturer:updated`
- `catalog:reset` — dev-only, fired after `/api/dev/reset`

Frontend usage pattern (already wired in `src/api/liveBus.ts`):

```ts
import { onLiveEvent } from './api/liveBus';

const unsubscribe = onLiveEvent('order:created', (order) => {
  // update UI
});
```

## Wiring in the real Garm customer app

**Correction from an earlier version of this doc:** the sections below used
to claim the Garm App talks to this admin server's `/api/garm/*` namespace for
everything (auth, orders, account, catalog). That was true for a while as a
*prototype* wiring, but the real Garm App (`../../Latest version of FAB`)
actually has its own separate, real backend (`Latest version of FAB/backend`,
Express + MongoDB, port 4000, see that project's own README) and talks to
**that**, via `VITE_API_URL=http://localhost:4000/api` — not to this server at
all, for auth/account/catalog. The `/api/garm/*` routes described below still
exist in `index.js` and still work, but nothing in the shipped Garm App
currently calls them — treat that namespace as a legacy prototype, not the
live integration.

**The one exception is Orders/Quotes**, which now *are* genuinely shared — not
through `/api/garm/orders`, but because this server and
`Latest version of FAB/backend` both read/write the same MongoDB collections
directly (see the "Two backends, one Orders/Quotes database" section up top).
That's what actually makes a Garm App order show up in this admin portal.

If you want the legacy `/api/garm/*` namespace to become real again (e.g. to
consolidate auth/account/catalog into one backend instead of two), that's a
larger follow-up — happy to scope it, but it's out of scope for what was asked
this round (fixing orders not showing up in the admin portal).

<details>
<summary>Legacy prototype wiring (not currently called by the Garm App)</summary>

1. **Auth** — `POST /api/garm/auth/send-otp` / `verify-otp`, OTP-based,
   `devCode` echoed back when `OTP_DEV_MODE` is on.
2. **Orders, quotes, tracking, account** (`/api/garm/orders`, `/quotes`,
   `/track`, `/account/*`) — same MongoDB-backed order data as the admin
   routes above, but scoped through this server's own `customers`/session
   model in `db.json`, which is separate from the real Garm App's own `User`
   accounts in MongoDB. Profile edits, addresses, and payment methods here
   would persist to `db.json`'s `customers` collection, not the real
   `Latest version of FAB/backend` `User` documents the app actually reads.
3. **Catalog availability + new categories** (`/api/garm/catalog/*`) — reads
   this server's own `categoriesB2C`/`productsB2C`/`categoriesB2B`/`productsB2B`
   in `db.json`, matched by name against the Garm App's hardcoded catalog.

</details>

If the Garm App isn't a browser-based client (e.g. React Native), swap
`EventSource` for any SSE-compatible client library, or ask and this can be
changed to plain long-polling instead — the event *shapes* won't need to change.

## Access control model

There's no free "viewing as role" picker in the admin app. Sign-in is by
email, **verified with a one-time code** (`POST /api/auth/admin/send-otp`
then `/verify-otp`) — typing a provisioned email alone is no longer enough to
get in. Once verified, the role attached to that email decides which modules
that person can see (`src/data/mockData.ts`'s `ROLE_VIEWS` map). Only a Super
Admin can reach Settings → Users to provision new employees, change roles, or
disable access — enforced both in the UI and server-side (`POST/PUT/DELETE
/api/users` reject non-Super-Admins with 403), and everyone else's nav is
filtered by their assigned role, not by anything the browser lets them choose.

**Every `/api/*` admin route now requires a valid session** (the `Authorization:
Bearer <token>` header the frontend attaches automatically after sign-in,
managed in `src/api/client.ts`) — this used to be wide open; anyone who could
reach the backend could read or edit every order, customer, and employee
record with a plain `curl` request. The only exceptions are `/api/health` and
the two `/api/auth/admin/*` endpoints needed to sign in in the first place.
`/api/garm/*` (the customer-facing Garm App routes) are unaffected — those
already required a *customer* session token per-route.

Seeded accounts (see `server/seed.js`): `haneef@garm.com` (Super Admin), plus
sample Operations Manager / QC Supervisor / Finance Manager / Warehouse
Manager accounts at `@garm.com`. No passwords — the OTP *is* the credential,
same model as the Garm App's own customer login. Codes expire in 5 minutes,
lock out after 5 wrong attempts, and are rate-limited per email and per IP.

## Security — what's protected and how

- **Encryption at rest.** Customer/employee PII (name, phone, email),
  address lines, and payment metadata (UPI IDs, card holder name/expiry —
  never the full card number or CVV, which never reach this server at all)
  are encrypted (AES-256-GCM) inside `server/db.json`. If that file is copied
  or stolen, those fields are unreadable without the server's key. Everything
  else (ids, statuses, category/product records, order line items) stays
  plaintext on disk — encrypting those wouldn't protect anything sensitive
  and would only make the admin's own queries harder. See `server/security.js`
  for the full explanation, including why this is **not** "end-to-end
  encryption" in the strict sense (this server can still read the data once
  loaded into memory — admin staff need to, to do their jobs).
- **Hashed tokens/OTP codes.** Session tokens and OTP codes are stored as
  one-way SHA-256 hashes, never in plaintext — a stolen `db.json` can't be
  replayed as a valid login or a valid code.
- **Encryption key.** Set `GARM_SECRET_KEY` (64 hex chars = 32 bytes) in
  production and manage it in a real secret manager. Without it, a key is
  auto-generated into `server/.server-secret` (gitignored, dev-only
  convenience) on first run — **losing that file makes the encrypted data in
  db.json permanently unrecoverable**, so don't rely on it past local dev.
- **Rate limiting.** OTP send/verify (both admin and Garm App customer) are
  throttled per identity and per IP (in-memory, resets on restart — swap for
  Redis if you run multiple backend instances).
- **CORS allow-list.** `ALLOWED_ORIGINS` (comma-separated), defaults to the
  local dev servers. An API returning customer PII should never be wide open
  (`*`) cross-origin — that would let any website a customer visits read
  their data using their own logged-in session.
- **What this does NOT do yet:** terminate HTTPS (this is plain Node `http`;
  put a reverse proxy / hosting platform's TLS in front before this is public
  — see the checklist below), or send real OTPs (`devCode` in responses is
  gated by `OTP_DEV_MODE`, defaulting on in this sandbox since there's no
  Twilio/Gmail configured — **must** be turned off, and a real gateway wired
  in, before launch).

### Before this goes live — checklist

- [ ] Put this behind HTTPS (reverse proxy, load balancer, or your hosting
      platform's TLS termination) — nothing here encrypts traffic in transit today.
- [ ] Set `GARM_SECRET_KEY` from a real secret manager; delete `server/.server-secret`.
- [ ] Set `OTP_DEV_MODE=false` and wire a real SMS/email provider into
      `db.createOtp`'s caller in `server/index.js` (Twilio/Gmail/etc.) so
      `devCode` stops being generated at all.
- [ ] Set `ALLOWED_ORIGINS` to your real domain(s) — remove the localhost defaults.
- [ ] Swap `server/db.json` for a real database (Postgres/etc.) with its own
      encrypted backups — a JSON file is fine for this dev/demo stage, not for
      production scale or durability.
- [ ] Rotate `GARM_SECRET_KEY` on a schedule and after any suspected exposure
      (this requires re-encrypting existing data with the old + new key — plan
      for that migration before rotating, don't do it live without a plan).

## CORS / environment

Backend port: `PORT` env var, defaults to `5050`. (Not 5000 — macOS's AirPlay
Receiver squats on port 5000 on some machines, silently blocking the backend
from starting; 5050 avoids that.)
Frontend reads the backend URL from `VITE_API_URL`, defaults to `http://localhost:5050`
(see `src/api/config.ts`).

Other env vars: `GARM_SECRET_KEY`, `OTP_DEV_MODE`, `ALLOWED_ORIGINS` — see
the security section above — plus:

- `MONGODB_URI` — where Orders/Quotes live, e.g.
  `mongodb://localhost:27017/garm`. **Must match** `Latest version of
  FAB/backend`'s own `.env` value exactly — they read/write the same
  database. If unset, both default to the same local value, so no
  configuration is needed as long as you haven't changed one independently.
