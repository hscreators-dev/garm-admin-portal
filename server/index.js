// Garm Admin backend — REST API + live push, using only Node.js core modules.
//
// Why no Express/Socket.io: this sandbox's npm registry access is blocked, so the
// backend is written dependency-free on purpose. It also means anyone can run it
// with just `node index.js` — no `npm install` step, nothing that can fail to
// resolve. Swap in Express/Prisma/Socket.io later if you want; the route logic
// and the broadcast() function are the only things that would need to move.
//
// Real-time transport: Server-Sent Events (SSE) instead of WebSocket. SSE needs
// zero libraries on either side — the browser's native `EventSource` API reads it
// directly. It's one-directional (server -> client), which is exactly what the
// admin dashboard and the Garm customer app need: instant push when an order is
// placed, a category changes, a product is edited, etc.

import { createServer } from 'http';
import { db, resetToSeed } from './store.js';
import { rateLimit } from './security.js';
import { connectMongo, MongoTicket } from './mongo.js';
import { ACCESSORY_SPECS_BY_CATEGORY } from './seed.js';
import { deliverOtp } from './otpDelivery.js';

// Default 5050, not 5000 — macOS AirPlay Receiver squats on 5000 on some machines,
// and this matches the frontend's default VITE_API_URL (src/api/config.ts).
const PORT = process.env.PORT || 5050;

// Only echo the real OTP code back in API responses (`devCode`) while there's
// no real SMS/email gateway wired up, so login flows stay testable in this
// sandbox. HARD SAFETY: this is FORCED OFF whenever NODE_ENV === 'production',
// regardless of OTP_DEV_MODE — otherwise anyone could request a code for any
// admin/customer email and get it straight back in the response, then log in
// as that account. In production you MUST wire a real Twilio/Gmail send.
const OTP_DEV_MODE = process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_MODE !== 'false';
if (process.env.NODE_ENV === 'production' && process.env.OTP_DEV_MODE !== 'false' && !process.env.OTP_GATEWAY_WIRED) {
  console.warn('[security] OTP dev-code is force-disabled in production. Wire a real SMS/email gateway so codes can actually be delivered.');
}

// CORS allow-list — comma-separated origins in ALLOWED_ORIGINS, defaulting to
// the two local dev servers (admin portal + Garm App) so nothing changes for
// local development. Do NOT set this to '*' in production: wide-open CORS on
// an API that returns customer PII means any website a customer visits could
// silently read their data using their own browser session.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:4173,capacitor://localhost,http://localhost')
  .split(',').map((o) => o.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Live push (SSE) — replaces the WebSocket layer from the integration spec
// ---------------------------------------------------------------------------
const sseClients = new Set();

function broadcast(event, payload) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) res.write(chunk);
  console.log(`[push] ${event}`, JSON.stringify(payload).slice(0, 160));
}

// ---------------------------------------------------------------------------
// Tiny helpers: JSON body parsing + CORS, no framework needed for this size.
// ---------------------------------------------------------------------------
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 15 * 1024 * 1024) req.destroy(); }); // 15MB cap (base64 images)
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const origin = req.headers.origin;
  // Reflect the origin only if it's on the allow-list, instead of the old
  // `*` — an API returning customer PII should never be readable cross-origin
  // by an arbitrary site. Non-browser clients (curl, the mobile app's native
  // HTTP layer) don't send an Origin header at all and are unaffected either way.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Baseline hardening headers. Strict-Transport-Security only matters once
  // this sits behind real TLS (see server/README.md) but is harmless to set
  // now; this process itself does not terminate HTTPS.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function clientIp(res) {
  const fwd = res.req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return res.req.socket?.remoteAddress || 'unknown';
}

// URL path segments are lowercase (b2c/b2b); the store's audience values are
// uppercase ('B2C'/'B2B') to match order.type and category/product.audience.
function audienceOf(params) { return params.audience === 'b2b' ? 'B2B' : 'B2C'; }

// ---------------------------------------------------------------------------
// Garm App integration — the customer-facing mobile app (individuals +
// organisations) talks to this same backend under the /api/garm/* namespace,
// entirely separate paths from the admin routes above so the two can never
// collide, while both read/write the exact same underlying db.json records.
// An order placed here is the same record the admin Orders table shows live.
// ---------------------------------------------------------------------------
function requireCustomer(res) {
  const header = res.req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  return db.getSessionCustomer(token);
}

// Admin portal auth — every /api/* route (admin-side) requires a valid,
// OTP-verified employee session now; see the global gate near the bottom of
// this file. Previously these routes had no auth check at all.
function requireAdmin(res) {
  const header = res.req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const user = db.getSessionUser(token);
  if (!user || user.status === 'Disabled') return null;
  return user;
}

function toUserProfile(c) {
  return {
    _id: String(c.id),
    name: c.name,
    phone: c.phone || undefined,
    email: c.email || undefined,
    accountType: c.accountType === 'organisation' ? 'organisation' : 'personal',
    orgName: c.orgName || undefined,
    orgType: c.orgType || undefined,
    orgBoard: c.orgBoard || undefined,
    designation: c.designation || undefined,
    twoFAEnabled: !!c.twoFAEnabled,
    onboardingComplete: !!c.onboardingComplete,
  };
}

// Stage labels/sub-text now live in db.trackStages (admin-editable via
// GET/PUT /api/track-stages) instead of being hardcoded here.
//
// Individuals (B2C) never go through in-house QC in the Garm App — only bulk
// Organisation (B2B) manufacturing runs are inspected before invoicing. Stages
// flagged `orgOnly` in db.trackStages (QC_READY, QC_APPROVED) are dropped
// entirely from a B2C order's tracker, so an individual customer sees
// In production -> Invoiced directly, never a "Quality check" step.
function buildTrackSteps(o) {
  if (o.status === 'CANCELLED') {
    return [{ label: 'Order cancelled', sub: 'This order was cancelled', status: 'cancelled' }];
  }
  const isOrg = o.type === 'B2B' || o.persona === 'organisation';
  const stages = db.listTrackStages().filter((s) => (isOrg ? !s.b2cOnly : !s.orgOnly));
  const idx = stages.findIndex((s) => s.key === o.status);
  return stages.map((s, i) => ({
    label: s.label,
    sub: s.sub,
    status: idx < 0 ? 'upcoming' : i < idx ? 'done' : i === idx ? 'active' : 'upcoming',
  }));
}

function toGarmOrder(o) {
  return {
    _id: String(o.id),
    orderRef: o.orderRef || o.no,
    persona: o.persona || (o.type === 'B2B' ? 'organisation' : 'individual'),
    isAccessoryOrder: !!o.isAccessoryOrder,
    orgType: o.orgType || undefined,
    orgName: o.orgName || undefined,
    service: o.service || undefined,
    serviceLabel: o.serviceLabel || undefined,
    garmentType: o.garmentType || undefined,
    fabric: o.fabric || undefined,
    gsm: o.gsm || undefined,
    qty: o.qty,
    sizes: o.sizes || [],
    colors: o.colors || [],
    accessoryItems: o.accessoryItems || [],
    status: o.status,
    trackSteps: buildTrackSteps(o),
    etaDate: o.etaDate || undefined,
    quoteAmount: o.quoteAmount ?? (o.total || undefined),
    paymentStatus: o.pay,
    createdAt: o.date,
  };
}

function toTrackOrder(o) {
  return {
    id: String(o.id),
    orderRef: o.orderRef || o.no,
    status: o.status,
    etaDate: o.etaDate || undefined,
    trackSteps: buildTrackSteps(o),
    isAccessoryOrder: !!o.isAccessoryOrder,
    qty: o.qty,
  };
}

function toGarmQuote(q) {
  return {
    _id: String(q.id),
    orderId: String(q.orderId),
    amount: q.amount,
    currency: q.currency,
    breakdown: q.breakdown,
    validUntil: q.validUntil,
    status: q.status,
    rejectionNote: q.rejectionNote || undefined,
    createdAt: q.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Routes — [method, regex with named params via (?<name>...), handler]
// ---------------------------------------------------------------------------
const routes = [
  ['GET', /^\/api\/health$/, async (_params, _body, res) => send(res, 200, { ok: true, time: new Date().toISOString() })],

  // Live push stream
  ['GET', /^\/api\/events$/, async (_params, _body, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // CORS header for this response already set by setCors() above (origin
      // allow-list), not hardcoded '*' here anymore.
    });
    res.write(`event: connected\ndata: {"ok":true}\n\n`);
    sseClients.add(res);
    res.req.on('close', () => sseClients.delete(res));
  }],

  // Categories & Products — Individuals (B2C) and Organizations (B2B) are
  // fully separate catalogs (separate tables, separate ids; see store.js),
  // so every route is scoped by an :audience path segment. There is no
  // route that reads or writes across both at once.
  ['GET', /^\/api\/catalog\/(?<audience>b2c|b2b)\/categories$/, async (p, _b, res) => {
    send(res, 200, db.listCategories(audienceOf(p)));
  }],
  ['POST', /^\/api\/catalog\/(?<audience>b2c|b2b)\/categories$/, async (p, body, res) => {
    if (!body.name) return send(res, 400, { error: 'Category name is required' });
    const category = db.createCategory(audienceOf(p), body);
    broadcast('category:created', category);
    send(res, 201, category);
  }],
  ['PUT', /^\/api\/catalog\/(?<audience>b2c|b2b)\/categories\/(?<id>\d+)$/, async (p, body, res) => {
    const category = db.updateCategory(audienceOf(p), Number(p.id), body);
    if (!category) return send(res, 404, { error: 'Category not found' });
    broadcast('category:updated', category);
    send(res, 200, category);
  }],
  ['DELETE', /^\/api\/catalog\/(?<audience>b2c|b2b)\/categories\/(?<id>\d+)$/, async (p, _b, res) => {
    const result = db.deleteCategory(audienceOf(p), Number(p.id));
    if (result.error) return send(res, 400, result);
    broadcast('category:deleted', { id: Number(p.id), audience: audienceOf(p) });
    send(res, 200, result);
  }],

  // Products
  ['GET', /^\/api\/catalog\/(?<audience>b2c|b2b)\/products$/, async (p, _b, res) => {
    send(res, 200, db.listProducts(audienceOf(p)));
  }],
  ['POST', /^\/api\/catalog\/(?<audience>b2c|b2b)\/products$/, async (p, body, res) => {
    if (!body.name) return send(res, 400, { error: 'Product name is required' });
    const product = db.createProduct(audienceOf(p), body);
    broadcast('product:created', product);
    send(res, 201, product);
  }],
  ['PUT', /^\/api\/catalog\/(?<audience>b2c|b2b)\/products\/(?<id>\d+)$/, async (p, body, res) => {
    const product = db.updateProduct(audienceOf(p), Number(p.id), body);
    if (!product) return send(res, 404, { error: 'Product not found' });
    broadcast('product:updated', product);
    send(res, 200, product);
  }],
  ['DELETE', /^\/api\/catalog\/(?<audience>b2c|b2b)\/products\/(?<id>\d+)$/, async (p, _b, res) => {
    const result = db.deleteProduct(audienceOf(p), Number(p.id));
    if (!result) return send(res, 404, { error: 'Product not found' });
    broadcast('product:deleted', { id: Number(p.id), audience: audienceOf(p) });
    send(res, 200, result);
  }],
  ['PATCH', /^\/api\/catalog\/(?<audience>b2c|b2b)\/products\/(?<id>\d+)\/status$/, async (p, body, res) => {
    const product = db.setProductStatus(audienceOf(p), Number(p.id), body.status);
    if (!product) return send(res, 404, { error: 'Product not found' });
    broadcast(product.status === 'ACTIVE' ? 'product:updated' : 'product:deactivated', product);
    send(res, 200, product);
  }],
  // Stock availability — flips instantly in the Garm App: an out-of-stock
  // product stays visible but greyed out and can't be ordered.
  ['PATCH', /^\/api\/catalog\/(?<audience>b2c|b2b)\/products\/(?<id>\d+)\/stock$/, async (p, body, res) => {
    const product = db.setProductStock(audienceOf(p), Number(p.id), body.inStock);
    if (!product) return send(res, 404, { error: 'Product not found' });
    broadcast('product:updated', product);
    send(res, 200, product);
  }],

  // Track order stages — customer-facing label/sub-text per order status,
  // shown on the Garm App's tracking screen (Order.trackSteps). `key` is
  // fixed (it's the order.status value), only label/sub are editable.
  // Spec-field starter templates — the SAME pre-filled option lists the app's
  // built-in accessory categories carry (Material / Finish / Print method /
  // Device spec…), keyed by category name. Lets the Catalog product modal
  // offer "start from a template" so brand-new products/categories don't begin
  // from a blank slate. Read-only reference data.
  ['GET', /^\/api\/spec-templates$/, async (_p, _b, res) => send(res, 200, { templates: ACCESSORY_SPECS_BY_CATEGORY })],
  ['GET', /^\/api\/track-stages$/, async (_p, _b, res) => send(res, 200, db.listTrackStages())],
  ['PUT', /^\/api\/track-stages$/, async (_p, body, res) => {
    const result = db.updateTrackStages(body.stages || body);
    if (result?.error) return send(res, 400, result);
    broadcast('track-stages:updated', result);
    send(res, 200, result);
  }],

  // App settings — Feature Toggles + Company/billing details. Both used to be
  // pure mock local state in Settings.tsx with no backend behind them at all.
  // Reads are open to any authenticated admin (already enforced by the global
  // auth gate below); writes are Super-Admin-only, matching the /api/users
  // precedent, since these control payment/billing config and platform features.
  ['GET', /^\/api\/settings$/, async (_p, _b, res) => send(res, 200, db.getSettings())],
  ['PUT', /^\/api\/settings\/features\/(?<key>[\w-]+)$/, async (p, body, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can change feature toggles' });
    const result = db.updateFeatureToggle(p.key, body.on);
    if (result?.error) return send(res, 404, result);
    broadcast('settings:features-updated', result);
    send(res, 200, result);
  }],
  ['PUT', /^\/api\/settings\/company$/, async (_p, body, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can change company/billing details' });
    const result = db.updateCompanyDetails(body);
    broadcast('settings:company-updated', result);
    send(res, 200, result);
  }],
  // Procurement coordinator ("Your procurement manager" in the Garm App).
  // Contact details are company-wide — the per-order employee NAME comes from
  // order.assignedEmployee, set when an admin assigns/accepts an order.
  ['PUT', /^\/api\/settings\/coordinator$/, async (_p, body, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can change coordinator details' });
    const result = db.updateCoordinator(body);
    broadcast('settings:coordinator-updated', result);
    send(res, 200, result);
  }],
  // Garm App order-form section toggles (style / materials / sizes /
  // references / live preview) — read live by the app's custom order flow.
  ['PUT', /^\/api\/settings\/order-form$/, async (_p, body, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can change the Garm App order form' });
    const result = db.updateOrderForm(body);
    broadcast('settings:order-form-updated', result);
    send(res, 200, result);
  }],
  ['PUT', /^\/api\/settings\/service-fee$/, async (_p, body, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can change the service fee' });
    const result = db.updateServiceFee(body);
    broadcast('settings:service-fee-updated', result);
    send(res, 200, result);
  }],

  // Manufacturers
  ['GET', /^\/api\/manufacturers$/, async (_p, _b, res) => send(res, 200, db.listManufacturers())],
  ['PUT', /^\/api\/manufacturers\/(?<id>\d+)$/, async (p, body, res) => {
    const m = db.updateManufacturer(Number(p.id), body);
    if (!m) return send(res, 404, { error: 'Manufacturer not found' });
    broadcast('manufacturer:updated', m);
    send(res, 200, m);
  }],

  // ---- Support tickets (admin side — sees all, replies, changes status).
  // Stored in the SAME MongoDB the Garm App writes to via the FAB backend. ----
  ['GET', /^\/api\/support\/tickets$/, async (_p, _b, res) => {
    const tickets = await MongoTicket.find().sort({ updatedAt: -1 }).lean();
    send(res, 200, { tickets });
  }],
  ['GET', /^\/api\/support\/tickets\/(?<id>[a-f0-9]{24})$/, async (p, _b, res) => {
    const t = await MongoTicket.findById(p.id).lean();
    if (!t) return send(res, 404, { error: 'Ticket not found' });
    send(res, 200, { ticket: t });
  }],
  ['PATCH', /^\/api\/support\/tickets\/(?<id>[a-f0-9]{24})$/, async (p, body, res) => {
    const patch = {};
    for (const k of ['status', 'priority', 'assignedTo']) if (body[k] !== undefined) patch[k] = body[k];
    const t = await MongoTicket.findByIdAndUpdate(p.id, { $set: patch }, { new: true }).lean();
    if (!t) return send(res, 404, { error: 'Ticket not found' });
    broadcast('support:ticket_updated', t);
    send(res, 200, { ticket: t });
  }],
  ['POST', /^\/api\/support\/tickets\/(?<id>[a-f0-9]{24})\/messages$/, async (p, body, res) => {
    const requester = requireAdmin(res);
    const text = String(body.body || '').trim();
    if (!text) return send(res, 400, { error: 'Message cannot be empty' });
    const doc = await MongoTicket.findById(p.id);
    if (!doc) return send(res, 404, { error: 'Ticket not found' });
    doc.messages.push({ from: 'admin', authorName: requester?.name || 'Garm Support', body: text, at: new Date() });
    if (doc.status === 'OPEN') doc.status = 'IN_PROGRESS';
    await doc.save();
    broadcast('support:ticket_updated', doc.toObject());
    send(res, 200, { ticket: doc.toObject() });
  }],
  // Return decision — verify the damage claim, then APPROVE or DECLINE. Posts a
  // system message so the customer sees the outcome in their ticket thread.
  ['POST', /^\/api\/support\/tickets\/(?<id>[a-f0-9]{24})\/return-decision$/, async (p, body, res) => {
    const requester = requireAdmin(res);
    const decision = String(body.decision || '').toUpperCase();
    if (!['APPROVED', 'DECLINED'].includes(decision)) return send(res, 400, { error: 'decision must be APPROVED or DECLINED' });
    const doc = await MongoTicket.findById(p.id);
    if (!doc) return send(res, 404, { error: 'Ticket not found' });
    if (doc.type !== 'return') return send(res, 400, { error: 'Not a return request' });
    doc.returnStatus = decision;
    doc.status = decision === 'APPROVED' ? 'IN_PROGRESS' : 'RESOLVED';
    const note = String(body.note || '').trim();
    const msg = decision === 'APPROVED'
      ? `Return approved. ${note || 'Our team will arrange pickup/replacement and follow up here.'}`
      : `Return declined. ${note || 'After reviewing the photos, this does not qualify for a return. Reply here if you have more details.'}`;
    doc.messages.push({ from: 'admin', authorName: requester?.name || 'Garm Support', body: msg, at: new Date() });
    await doc.save();
    broadcast('support:ticket_updated', doc.toObject());
    send(res, 200, { ticket: doc.toObject() });
  }],

  // Orders — the admin <-> Garm App handshake. Backed by the same MongoDB
  // the Garm App's own backend writes to (see server/mongo.js) — every
  // db.*Order*/*Quote* call below is now async.
  ['GET', /^\/api\/orders$/, async (_p, _b, res) => send(res, 200, await db.listOrders())],
  ['GET', /^\/api\/orders\/(?<id>\d+)$/, async (p, _b, res) => {
    const order = await db.getOrder(Number(p.id));
    if (!order) return send(res, 404, { error: 'Order not found' });
    send(res, 200, order);
  }],
  ['POST', /^\/api\/orders$/, async (_p, body, res) => {
    const order = await db.createOrder(body);
    broadcast('order:created', order);
    send(res, 201, order);
  }],
  ['PUT', /^\/api\/orders\/(?<id>\d+)\/status$/, async (p, body, res) => {
    const existing = await db.getOrder(Number(p.id));
    if (!existing) return send(res, 404, { error: 'Order not found' });
    const isB2C = existing.type === 'B2C';
    // Individuals (B2C) skip in-house QC entirely — only Organisation (B2B)
    // orders go through inspection. Block the status transition rather than
    // silently allowing an Individual order to sit in a QC stage that isn't
    // even shown on their tracker (see buildTrackSteps above).
    if (isB2C && (body.status === 'QC_READY' || body.status === 'QC_APPROVED')) {
      return send(res, 400, { error: 'Individual orders skip QC.' });
    }
    // B2C flow gates: submit -> CONFIRM (admin) -> customer pays -> production.
    if (body.status === 'CONFIRMED' && !isB2C) {
      return send(res, 400, { error: 'Only Individual orders use Accept & Confirm — Organisation orders are confirmed by issuing a quote.' });
    }
    if (isB2C && body.status === 'INVOICED') {
      return send(res, 400, { error: 'Individual orders are paid in the Garm App after confirmation — no separate invoicing step.' });
    }
    if (isB2C && ['ASSIGNED', 'IN_PROGRESS', 'SHIPPED', 'DELIVERED'].includes(body.status)) {
      if (!existing.confirmedAt && existing.status === 'NEW') {
        return send(res, 400, { error: 'Accept & Confirm this order first — the customer must see the confirmation and pay before production.' });
      }
      const paid = existing.paymentStatus === 'paid' || existing.pay === 'COMPLETED' || body.pay === 'COMPLETED';
      if (!paid) {
        return send(res, 400, { error: "Customer hasn't paid yet — production starts only after payment is received." });
      }
    }
    // Organisation gates: ADVANCE before production starts, BALANCE (full
    // payment) before shipping.
    if (!isB2C) {
      const advancePaid = ['partial', 'paid'].includes(existing.paymentStatus) || ['PARTIAL', 'COMPLETED'].includes(existing.pay) || ['PARTIAL', 'COMPLETED'].includes(body.pay);
      const fullyPaid = existing.paymentStatus === 'paid' || existing.pay === 'COMPLETED' || body.pay === 'COMPLETED';
      if (['ASSIGNED', 'IN_PROGRESS'].includes(body.status) && !advancePaid) {
        return send(res, 400, { error: "Advance payment hasn't been received yet — organisation production starts only after the advance. Record it (Record Offline Payment) or wait for the customer to pay in the app." });
      }
      if (['SHIPPED', 'DELIVERED'].includes(body.status) && !fullyPaid) {
        return send(res, 400, { error: "Balance payment hasn't been received yet — shipping starts only after full payment. Record it or wait for the customer to pay the balance in the app." });
      }
    }
    const order = await db.updateOrderStatus(Number(p.id), body);
    if (!order) return send(res, 404, { error: 'Order not found' });
    broadcast('order:status_changed', order);
    // Issuing/updating a quote amount from the admin's existing order screen
    // is what makes it show up for the customer in the Garm App — no separate
    // admin "quotes" UI needed for this first pass.
    if (body.quoteAmount !== undefined && body.quoteAmount !== null) {
      const quote = await db.upsertQuoteForOrder(order.id, { amount: Number(body.quoteAmount) });
      broadcast('quote:updated', toGarmQuote(quote));
    }
    send(res, 200, order);
  }],

  // Order documents — the admin uploads invoices/quotations/billing here;
  // they appear instantly in the customer's Garm App Documents section.
  // Customer design/logo references arrive on the order itself and are
  // downloadable from the same card.
  ['POST', /^\/api\/orders\/(?<id>\d+)\/documents$/, async (p, body, res) => {
    if (!body.name || !body.dataUrl) return send(res, 400, { error: 'name and dataUrl are required' });
    if (String(body.dataUrl).length > 6 * 1024 * 1024) return send(res, 400, { error: 'File too large — keep documents under ~4MB' });
    // Only safe formats (images + PDF). Blocks HTML/SVG/script payloads that a
    // browser could execute when the document is viewed/downloaded.
    if (!/^data:(image\/(png|jpe?g|webp|gif)|application\/pdf);base64,/i.test(String(body.dataUrl))) {
      return send(res, 400, { error: 'Only PNG, JPG, WEBP, GIF or PDF files are allowed' });
    }
    const order = await db.addOrderDocument(Number(p.id), body);
    if (!order) return send(res, 404, { error: 'Order not found' });
    broadcast('order:status_changed', order);
    send(res, 200, order);
  }],
  ['DELETE', /^\/api\/orders\/(?<id>\d+)\/documents\/(?<docId>[a-f0-9]+)$/, async (p, _b, res) => {
    const order = await db.deleteOrderDocument(Number(p.id), p.docId);
    if (!order) return send(res, 404, { error: 'Order not found' });
    broadcast('order:status_changed', order);
    send(res, 200, order);
  }],

  // Users — Super-Admin-provisioned identities driving role-based access control.
  // Signing in now goes through /api/auth/admin/* (OTP-verified) below, not
  // this lookup — this stays as an authenticated-only directory/management endpoint.
  ['GET', /^\/api\/users$/, async (_p, _b, res) => send(res, 200, db.listUsers())],
  ['GET', /^\/api\/users\/by-email\/(?<email>[^/]+)$/, async (p, _b, res) => {
    const user = db.getUserByEmail(decodeURIComponent(p.email));
    if (!user) return send(res, 404, { error: 'No account found for this email' });
    send(res, 200, user);
  }],
  ['POST', /^\/api\/users$/, async (_p, body, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can add employees' });
    if (!body.email) return send(res, 400, { error: 'Email is required' });
    const user = db.createUser(body);
    if (user.error) return send(res, 409, user);
    broadcast('user:created', user);
    send(res, 201, user);
  }],
  ['PUT', /^\/api\/users\/(?<id>\d+)$/, async (p, body, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can edit employee access' });
    const user = db.updateUser(Number(p.id), body);
    if (!user) return send(res, 404, { error: 'User not found' });
    broadcast('user:updated', user);
    send(res, 200, user);
  }],
  ['DELETE', /^\/api\/users\/(?<id>\d+)$/, async (p, _b, res) => {
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can remove employees' });
    await db.deleteUser(Number(p.id));
    broadcast('user:deleted', { id: Number(p.id) });
    send(res, 200, { ok: true });
  }],

  // ---- Admin portal: auth (OTP-verified sign-in — replaces the old
  // email-only "type any provisioned email" flow, which had no verification
  // step at all). Same infra as the Garm App's customer OTP below, kept in a
  // separate `purpose` bucket so identities never cross between the two. ----
  ['POST', /^\/api\/auth\/admin\/send-otp$/, async (_p, body, res) => {
    const ip = clientIp(res);
    if (!rateLimit(`admin-send:${ip}`, 20, 10 * 60 * 1000).allowed) return send(res, 429, { error: 'Too many attempts — try again shortly' });
    if (!body.email) return send(res, 400, { error: 'email is required' });
    const clean = String(body.email).trim().toLowerCase();
    if (!rateLimit(`admin-send:${clean}`, 5, 10 * 60 * 1000).allowed) return send(res, 429, { error: 'Too many codes requested for this email — try again shortly' });
    const user = db.getUserByEmail(clean);
    // Same response whether or not the email is provisioned, so this endpoint
    // can't be used to enumerate which emails have admin accounts.
    const generic = { success: true, message: 'If that email is registered, a verification code has been sent.' };
    if (!user || user.status === 'Disabled') return send(res, 200, generic);
    const rec = db.createOtp(clean, 'email', 'admin');
    const result = await deliverOtp({ identity: clean, mode: 'email', code: rec.code });
    if (result.delivered) console.log(`[admin otp] sent to ${rec.identity} via ${result.channel}`);
    else {
      console.log(`[admin otp] ${rec.identity} code=${rec.code} (not delivered: ${result.reason})`);
      // In production a real gateway MUST be configured — fail loudly rather
      // than silently issuing a code nobody receives.
      if (process.env.NODE_ENV === 'production' && !OTP_DEV_MODE) return send(res, 502, { error: 'Verification service is temporarily unavailable. Please try again shortly.' });
    }
    send(res, 200, { ...generic, devCode: OTP_DEV_MODE ? rec.code : undefined });
  }],
  ['POST', /^\/api\/auth\/admin\/verify-otp$/, async (_p, body, res) => {
    const ip = clientIp(res);
    if (!rateLimit(`admin-verify:${ip}`, 30, 10 * 60 * 1000).allowed) return send(res, 429, { error: 'Too many attempts — try again shortly' });
    if (!body.email || !body.otp) return send(res, 400, { error: 'email and otp are required' });
    const clean = String(body.email).trim().toLowerCase();
    const result = db.verifyOtp(clean, body.otp, 'admin');
    if (result.error) return send(res, 401, result);
    const user = db.getUserByEmail(clean);
    if (!user) return send(res, 404, { error: 'No account found for this email' });
    if (user.status === 'Disabled') return send(res, 403, { error: 'This account has been disabled — contact your Super Admin' });
    db.touchUserLogin(user.id);
    const token = db.createAdminSession(user.id);
    send(res, 200, { token, user });
  }],
  ['GET', /^\/api\/auth\/admin\/me$/, async (_p, _b, res) => {
    const user = requireAdmin(res);
    if (!user) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { user });
  }],
  ['POST', /^\/api\/auth\/admin\/logout$/, async (_p, _b, res) => {
    const header = res.req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) db.destroyAdminSession(token);
    send(res, 200, { ok: true });
  }],

  // ---- Garm App: auth (OTP) ----
  // Dev-mode only: no Twilio/Gmail credentials exist in this environment, so
  // the OTP is logged server-side AND echoed back as `devCode` (gated by
  // OTP_DEV_MODE) so this can be tested end-to-end without a real SMS/email
  // gateway. Swap in real Twilio/Gmail sending before going live (see server/README.md).
  ['POST', /^\/api\/garm\/auth\/send-otp$/, async (_p, body, res) => {
    const ip = clientIp(res);
    if (!rateLimit(`garm-send:${ip}`, 20, 10 * 60 * 1000).allowed) return send(res, 429, { error: 'Too many attempts — try again shortly' });
    if (!body.identity) return send(res, 400, { error: 'identity is required' });
    const clean = String(body.identity).trim().toLowerCase();
    if (!rateLimit(`garm-send:${clean}`, 5, 10 * 60 * 1000).allowed) return send(res, 429, { error: 'Too many codes requested — try again shortly' });
    const mode = body.mode === 'email' || String(body.identity).includes('@') ? 'email' : 'phone';
    const rec = db.createOtp(body.identity, mode, 'customer');
    const result = await deliverOtp({ identity: clean, mode, code: rec.code });
    if (result.delivered) console.log(`[garm otp] sent to ${rec.identity} via ${result.channel}`);
    else {
      console.log(`[garm otp] ${rec.identity} (${mode}) code=${rec.code} (not delivered: ${result.reason})`);
      if (process.env.NODE_ENV === 'production' && !OTP_DEV_MODE) return send(res, 502, { error: 'Verification service is temporarily unavailable. Please try again shortly.' });
    }
    send(res, 200, { success: true, message: `OTP sent via ${mode}`, devCode: OTP_DEV_MODE ? rec.code : undefined });
  }],
  ['POST', /^\/api\/garm\/auth\/verify-otp$/, async (_p, body, res) => {
    const ip = clientIp(res);
    if (!rateLimit(`garm-verify:${ip}`, 30, 10 * 60 * 1000).allowed) return send(res, 429, { error: 'Too many attempts — try again shortly' });
    const result = db.verifyOtp(body.identity, body.otp, 'customer');
    if (result.error) return send(res, 401, result);
    let customer = db.getCustomerByIdentity(body.identity);
    if (!customer) {
      const isEmail = (body.mode || 'phone') === 'email' || String(body.identity).includes('@');
      customer = db.createCustomer(isEmail ? { email: body.identity } : { phone: body.identity });
    }
    const token = db.createSession(customer.id);
    send(res, 200, { token, user: toUserProfile(customer) });
  }],
  ['GET', /^\/api\/garm\/auth\/me$/, async (_p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { user: toUserProfile(customer) });
  }],
  ['POST', /^\/api\/garm\/auth\/logout$/, async (_p, _b, res) => {
    const header = res.req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token) db.destroySession(token);
    send(res, 200, { ok: true });
  }],

  // ---- Garm App: orders (same underlying orders table the admin uses) ----
  ['GET', /^\/api\/garm\/orders$/, async (_p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { orders: (await db.listOrdersByCustomer(customer.id)).map(toGarmOrder) });
  }],
  ['GET', /^\/api\/garm\/orders\/(?<id>\d+)$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const order = await db.getOrder(Number(p.id));
    if (!order || order.customerId !== customer.id) return send(res, 404, { error: 'Order not found' });
    send(res, 200, { order: toGarmOrder(order) });
  }],
  ['POST', /^\/api\/garm\/orders$/, async (_p, body, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const persona = body.persona || (customer.accountType === 'organisation' ? 'organisation' : 'individual');
    const order = await db.createOrder({
      ...body,
      customerId: customer.id,
      persona,
      cust: customer.orgName || customer.name,
      type: persona === 'organisation' ? 'B2B' : 'B2C',
      email: customer.email || '',
      address: customer.addresses?.find((a) => a.isDefault)?.line1 || customer.addresses?.[0]?.line1 || '',
    });
    broadcast('order:created', order);
    send(res, 201, { order: toGarmOrder(order) });
  }],
  ['PATCH', /^\/api\/garm\/orders\/(?<id>\d+)$/, async (p, body, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const existing = await db.getOrder(Number(p.id));
    if (!existing || existing.customerId !== customer.id) return send(res, 404, { error: 'Order not found' });
    // SECURITY: a customer must NOT be able to set operational fields
    // (status / adminStatus / pay / total / quoteAmount / manufacturer / qc).
    // updateOrderStatus() maps exactly those, so calling it with a raw customer
    // body let a customer mark their own order paid/delivered or rewrite the
    // amount. Restrict customers to editable order details only.
    const safe = {};
    for (const k of ['notes', 'deliveryAddress', 'deliveryCity', 'deliveryPin', 'contactName', 'contactPhone', 'contactEmail']) {
      if (body[k] !== undefined) safe[k] = body[k];
    }
    const order = await db.updateOrderDetails(Number(p.id), safe);
    broadcast('order:status_changed', order);
    send(res, 200, { order: toGarmOrder(order) });
  }],
  ['DELETE', /^\/api\/garm\/orders\/(?<id>\d+)$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const existing = await db.getOrder(Number(p.id));
    if (!existing || existing.customerId !== customer.id) return send(res, 404, { error: 'Order not found' });
    const order = await db.updateOrderStatus(Number(p.id), { status: 'CANCELLED' });
    broadcast('order:status_changed', order);
    send(res, 200, { success: true, order: toGarmOrder(order) });
  }],
  ['POST', /^\/api\/garm\/orders\/(?<id>\d+)\/reorder$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const existing = await db.getOrder(Number(p.id));
    if (!existing || existing.customerId !== customer.id) return send(res, 404, { error: 'Order not found' });
    const order = await db.createOrder({
      ...existing,
      customerId: customer.id,
      quoteAmount: null,
    });
    broadcast('order:created', order);
    send(res, 201, { order: toGarmOrder(order) });
  }],
  ['GET', /^\/api\/garm\/orders\/(?<id>\d+)\/quote$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const existing = await db.getOrder(Number(p.id));
    if (!existing || existing.customerId !== customer.id) return send(res, 404, { error: 'Order not found' });
    const quotes = await db.listQuotes();
    const quote = quotes.find((q) => q.orderId === existing.id);
    if (!quote) return send(res, 404, { error: 'No quote issued for this order yet' });
    send(res, 200, { quote: toGarmQuote(quote) });
  }],

  // ---- Garm App: account (profile, addresses, payment methods) ----
  ['GET', /^\/api\/garm\/account\/profile$/, async (_p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { user: toUserProfile(customer) });
  }],
  ['PUT', /^\/api\/garm\/account\/profile$/, async (_p, body, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const updated = db.updateCustomerProfile(customer.id, body);
    if (updated?.error) return send(res, 409, updated);
    send(res, 200, { user: toUserProfile(updated) });
  }],
  ['GET', /^\/api\/garm\/account\/addresses$/, async (_p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { addresses: customer.addresses });
  }],
  ['POST', /^\/api\/garm\/account\/addresses$/, async (_p, body, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { addresses: db.addCustomerAddress(customer.id, body) });
  }],
  ['PUT', /^\/api\/garm\/account\/addresses\/(?<id>[^/]+)$/, async (p, body, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const addresses = db.updateCustomerAddress(customer.id, p.id, body);
    if (!addresses) return send(res, 404, { error: 'Address not found' });
    send(res, 200, { addresses });
  }],
  ['DELETE', /^\/api\/garm\/account\/addresses\/(?<id>[^/]+)$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { addresses: db.deleteCustomerAddress(customer.id, p.id) });
  }],
  ['GET', /^\/api\/garm\/account\/payment$/, async (_p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { paymentMethods: customer.paymentMethods });
  }],
  ['POST', /^\/api\/garm\/account\/payment$/, async (_p, body, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { paymentMethods: db.addCustomerPayment(customer.id, body) });
  }],
  ['DELETE', /^\/api\/garm\/account\/payment\/(?<id>[^/]+)$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    send(res, 200, { paymentMethods: db.deleteCustomerPayment(customer.id, p.id) });
  }],
  ['PUT', /^\/api\/garm\/account\/payment\/(?<id>[^/]+)\/default$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const paymentMethods = db.setDefaultPayment(customer.id, p.id);
    if (!paymentMethods) return send(res, 404, { error: 'Payment method not found' });
    send(res, 200, { paymentMethods });
  }],

  // ---- Garm App: quotes ----
  ['GET', /^\/api\/garm\/quotes$/, async (_p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const myOrderIds = (await db.listOrdersByCustomer(customer.id)).map((o) => o.id);
    send(res, 200, { quotes: (await db.listQuotesByOrderIds(myOrderIds)).map(toGarmQuote) });
  }],
  ['GET', /^\/api\/garm\/quotes\/(?<id>\d+)$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const quote = await db.getQuote(Number(p.id));
    const order = quote && await db.getOrder(quote.orderId);
    if (!quote || !order || order.customerId !== customer.id) return send(res, 404, { error: 'Quote not found' });
    send(res, 200, { quote: toGarmQuote(quote) });
  }],
  ['POST', /^\/api\/garm\/quotes\/(?<id>\d+)\/approve$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const quote = await db.getQuote(Number(p.id));
    const order = quote && await db.getOrder(quote.orderId);
    if (!quote || !order || order.customerId !== customer.id) return send(res, 404, { error: 'Quote not found' });
    const updated = await db.setQuoteStatus(quote.id, 'approved');
    await db.updateOrderStatus(order.id, { total: quote.amount, quoteAmount: quote.amount });
    broadcast('quote:updated', toGarmQuote(updated));
    broadcast('order:status_changed', await db.getOrder(order.id));
    send(res, 200, { quote: toGarmQuote(updated) });
  }],
  ['POST', /^\/api\/garm\/quotes\/(?<id>\d+)\/reject$/, async (p, body, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const quote = await db.getQuote(Number(p.id));
    const order = quote && await db.getOrder(quote.orderId);
    if (!quote || !order || order.customerId !== customer.id) return send(res, 404, { error: 'Quote not found' });
    const updated = await db.setQuoteStatus(quote.id, 'rejected', body?.note);
    broadcast('quote:updated', toGarmQuote(updated));
    send(res, 200, { quote: toGarmQuote(updated) });
  }],

  // ---- Garm App: track ----
  ['GET', /^\/api\/garm\/track$/, async (_p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const orders = await db.listOrdersByCustomer(customer.id);
    const active = orders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status));
    send(res, 200, { orders: active.map(toTrackOrder) });
  }],
  ['GET', /^\/api\/garm\/track\/(?<ref>[^/]+)$/, async (p, _b, res) => {
    const customer = requireCustomer(res);
    if (!customer) return send(res, 401, { error: 'Not signed in' });
    const orders = await db.listOrdersByCustomer(customer.id);
    const order = orders.find((o) => o.no === p.ref || o.orderRef === p.ref || String(o.id) === p.ref);
    if (!order) return send(res, 404, { error: 'Order not found' });
    send(res, 200, toTrackOrder(order));
  }],

  // ---- Garm App: catalog (read-only mirror of the admin's categories/products).
  // Individuals and Organizations are separate catalogs server-side; pass
  // ?audience=b2c|b2b to read just one, or omit it to get both back in one
  // list, each item tagged with its own `audience` field. ----
  ['GET', /^\/api\/garm\/catalog\/categories$/, async (_p, _b, res) => {
    const audience = new URL(res.req.url, 'http://internal').searchParams.get('audience')?.toLowerCase();
    const categories = (audience ? db.listCategories(audienceOf({ audience })) : [...db.listCategories('B2C'), ...db.listCategories('B2B')])
      // appliesTo — compat shape the Garm App's availability hook filters by.
      .map((c) => ({ ...c, appliesTo: [c.audience] }));
    send(res, 200, { categories });
  }],
  ['GET', /^\/api\/garm\/catalog\/products$/, async (_p, _b, res) => {
    const audience = new URL(res.req.url, 'http://internal').searchParams.get('audience')?.toLowerCase();
    const products = (audience ? db.listProducts(audienceOf({ audience })) : [...db.listProducts('B2C'), ...db.listProducts('B2B')])
      .filter((pr) => pr.status === 'ACTIVE')
      // Out-of-stock products are still returned (inStock:false) so the app
      // can show them greyed out instead of hiding them.
      .map((pr) => ({ ...pr, appliesTo: [pr.audience] }));
    send(res, 200, { products });
  }],

  // Public read for the "Your procurement manager" card in the Garm App.
  ['GET', /^\/api\/garm\/coordinator$/, async (_p, _b, res) => {
    send(res, 200, { coordinator: db.getCoordinator() });
  }],
  // Public read for the Garm App order-form configuration + fee schedule.
  ['GET', /^\/api\/garm\/order-config$/, async (_p, _b, res) => {
    // Expose feature flags to the app as a simple {key: on} map so ordering can
    // actually be gated (B2C/B2B ordering, QC workflow). Notification channels
    // (email/sms/whatsapp) are included for completeness but require external
    // integration to do anything — the admin UI marks those as "needs setup".
    const features = {};
    for (const f of (db.getSettings?.().features || [])) features[f.key] = !!f.on;
    send(res, 200, { orderForm: db.getOrderForm(), serviceFee: db.getServiceFee(), features });
  }],

  // ---- Garm App: virtual try-on — not wired to an image-gen service in this
  // environment (needs IMAGE_API_URL/IMAGE_API_KEY from the old backend/.env.example).
  ['POST', /^\/api\/garm\/tryon$/, async (_p, _b, res) => {
    send(res, 501, { error: "Virtual try-on isn't connected to an image-generation service in this environment yet." });
  }],

  // Dev convenience. Orders/quotes live in MongoDB now, not the file seed, so
  // this only resets categories/products/manufacturers/settings/employees —
  // it does NOT touch or wipe any real Garm App order data.
  ['POST', /^\/api\/dev\/reset$/, async (_p, _b, res) => {
    // Destructive: wipes catalog/settings/employees back to seed. Never allow
    // it in production, and require a Super Admin even in dev.
    if (process.env.NODE_ENV === 'production') return send(res, 403, { error: 'Reset is disabled in production' });
    const requester = requireAdmin(res);
    if (!requester || requester.role !== 'Super Admin') return send(res, 403, { error: 'Only a Super Admin can reset the catalog' });
    const fresh = resetToSeed();
    broadcast('catalog:reset', {});
    send(res, 200, {
      ok: true,
      counts: {
        products: fresh.productsB2C.length + fresh.productsB2B.length,
        categories: fresh.categoriesB2C.length + fresh.categoriesB2B.length,
      },
    });
  }],
];

// Routes reachable with no admin session at all. Everything under /api/garm/*
// is excluded here too — not because it's public, but because each of those
// routes already does its own requireCustomer() check (a *customer* session,
// not an admin one). Every other /api/* route below now requires a valid,
// OTP-verified employee session — previously none of them had any auth check
// at all, meaning anyone who could reach this process could read or edit
// every order, customer, and employee record with a plain curl request.
const PUBLIC_ADMIN_ROUTES = [
  /^\/api\/health$/,
  /^\/api\/auth\/admin\/send-otp$/,
  /^\/api\/auth\/admin\/verify-otp$/,
];

const server = createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const pathname = req.url.split('?')[0];
  const route = routes.find(([method, regex]) => method === req.method && regex.test(pathname));

  if (!route) return send(res, 404, { error: `No route for ${req.method} ${pathname}` });

  const isGarmRoute = pathname.startsWith('/api/garm/');
  const isPublic = PUBLIC_ADMIN_ROUTES.some((r) => r.test(pathname));

  if (pathname === '/api/events') {
    // Browsers' native EventSource can't send an Authorization header, so the
    // admin session token travels as a query param here instead — checked
    // before the SSE stream opens (see liveBus.ts on the frontend).
    const token = new URL(req.url, 'http://internal').searchParams.get('token');
    const user = token ? db.getSessionUser(token) : null;
    if (!user) return send(res, 401, { error: 'Not signed in' });
  } else if (!isGarmRoute && !isPublic && !requireAdmin(res)) {
    return send(res, 401, { error: 'Not signed in' });
  }

  const [, regex, handler] = route;
  const match = pathname.match(regex);
  const params = match?.groups || {};

  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJsonBody(req) : {};
    await handler(params, body, res);
  } catch (err) {
    console.error(err);
    send(res, 400, { error: err.message || 'Bad request' });
  }
});

// Orders/Quotes now live in MongoDB — the same database the real Garm App
// backend (Latest version of FAB/backend) writes to, so an order placed in
// the app shows up here without any sync step. Connect before accepting
// traffic, but don't let a down/unreachable Mongo crash the whole process:
// catalog/settings/employees/auth all still work off the local file store
// either way, and Orders routes will just error clearly until Mongo is back.
connectMongo().catch(() => {
  console.error('[mongo] Starting anyway — every /api/orders and /api/garm/orders|quotes|track route will fail until MONGODB_URI is reachable.');
});

// Let the deployer sign in as Super Admin with their OWN email (so the OTP goes
// to a real inbox in production). Set SUPER_ADMIN_EMAIL in the environment.
if (process.env.SUPER_ADMIN_EMAIL) {
  const u = db.ensureSuperAdmin(process.env.SUPER_ADMIN_EMAIL);
  if (u) console.log(`[admin] Super Admin ready: ${u.email}`);
}

server.listen(PORT, () => {
  console.log(`Garm Admin backend listening on http://localhost:${PORT}`);
  console.log(`Live push stream: http://localhost:${PORT}/api/events (Server-Sent Events)`);
  console.log(`Orders/Quotes are read from MongoDB (MONGODB_URI=${(process.env.MONGODB_URI || 'mongodb://localhost:27017/garm').replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}) — the same database the Garm App's own backend uses.`);
  // Confirm the CATALOG the app depends on is present (auto-seeded on first
  // boot) so a fresh/empty deploy still shows products. This is separate from
  // MongoDB — the catalog lives in the admin's own store.
  try {
    const c = db.listCategories('B2C').length + db.listCategories('B2B').length;
    const p = db.listProducts('B2C').length + db.listProducts('B2B').length;
    console.log(`Catalog ready: ${c} categories, ${p} products — the Garm App will show these immediately.`);
  } catch { /* non-fatal */ }
});
