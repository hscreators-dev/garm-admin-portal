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

const PORT = process.env.PORT || 5000;

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

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`event: connected\ndata: {"ok":true}\n\n`);
    sseClients.add(res);
    res.req.on('close', () => sseClients.delete(res));
  }],

  // Categories
  ['GET', /^\/api\/categories$/, async (_p, _b, res) => send(res, 200, db.listCategories())],
  ['POST', /^\/api\/categories$/, async (_p, body, res) => {
    const category = db.createCategory(body);
    broadcast('category:created', category);
    send(res, 201, category);
  }],
  ['PUT', /^\/api\/categories\/(?<id>\d+)$/, async (p, body, res) => {
    const category = db.updateCategory(Number(p.id), body);
    if (!category) return send(res, 404, { error: 'Category not found' });
    broadcast('category:updated', category);
    send(res, 200, category);
  }],
  ['DELETE', /^\/api\/categories\/(?<id>\d+)$/, async (p, _b, res) => {
    const result = db.deleteCategory(Number(p.id));
    if (result.error) return send(res, 409, result);
    broadcast('category:deleted', { id: Number(p.id) });
    send(res, 200, { ok: true });
  }],

  // Products
  ['GET', /^\/api\/products$/, async (_p, _b, res) => send(res, 200, db.listProducts())],
  ['POST', /^\/api\/products$/, async (_p, body, res) => {
    const product = db.createProduct(body);
    broadcast('product:created', product);
    send(res, 201, product);
  }],
  ['PUT', /^\/api\/products\/(?<id>\d+)$/, async (p, body, res) => {
    const product = db.updateProduct(Number(p.id), body);
    if (!product) return send(res, 404, { error: 'Product not found' });
    broadcast('product:updated', product);
    send(res, 200, product);
  }],
  ['PATCH', /^\/api\/products\/(?<id>\d+)\/status$/, async (p, body, res) => {
    const product = db.setProductStatus(Number(p.id), body.status);
    if (!product) return send(res, 404, { error: 'Product not found' });
    broadcast(product.status === 'ACTIVE' ? 'product:updated' : 'product:deactivated', product);
    send(res, 200, product);
  }],

  // Manufacturers
  ['GET', /^\/api\/manufacturers$/, async (_p, _b, res) => send(res, 200, db.listManufacturers())],
  ['PUT', /^\/api\/manufacturers\/(?<id>\d+)$/, async (p, body, res) => {
    const m = db.updateManufacturer(Number(p.id), body);
    if (!m) return send(res, 404, { error: 'Manufacturer not found' });
    broadcast('manufacturer:updated', m);
    send(res, 200, m);
  }],

  // Orders — the admin <-> Garm App handshake
  ['GET', /^\/api\/orders$/, async (_p, _b, res) => send(res, 200, db.listOrders())],
  ['GET', /^\/api\/orders\/(?<id>\d+)$/, async (p, _b, res) => {
    const order = db.getOrder(Number(p.id));
    if (!order) return send(res, 404, { error: 'Order not found' });
    send(res, 200, order);
  }],
  ['POST', /^\/api\/orders$/, async (_p, body, res) => {
    const order = db.createOrder(body);
    broadcast('order:created', order);
    send(res, 201, order);
  }],
  ['PUT', /^\/api\/orders\/(?<id>\d+)\/status$/, async (p, body, res) => {
    const order = db.updateOrderStatus(Number(p.id), body);
    if (!order) return send(res, 404, { error: 'Order not found' });
    broadcast('order:status_changed', order);
    send(res, 200, order);
  }],

  // Dev convenience
  ['POST', /^\/api\/dev\/reset$/, async (_p, _b, res) => {
    const fresh = resetToSeed();
    broadcast('catalog:reset', {});
    send(res, 200, { ok: true, counts: { orders: fresh.orders.length, products: fresh.products.length, categories: fresh.categories.length } });
  }],
];

const server = createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const pathname = req.url.split('?')[0];
  const route = routes.find(([method, regex]) => method === req.method && regex.test(pathname));

  if (!route) return send(res, 404, { error: `No route for ${req.method} ${pathname}` });

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

server.listen(PORT, () => {
  console.log(`Garm Admin backend listening on http://localhost:${PORT}`);
  console.log(`Live push stream: http://localhost:${PORT}/api/events (Server-Sent Events)`);
  console.log(`No dependencies required — pure Node.js. Run 'npm run simulate' in another terminal to test the order flow.`);
});
