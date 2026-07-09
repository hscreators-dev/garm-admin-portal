// Stand-in for the real Garm customer app until it's wired in.
// Places one realistic order against the running backend so you can see the
// full loop work: this script -> POST /api/orders -> WebSocket 'order:created'
// -> admin Dashboard shows a live notification, no refresh needed.
//
// Usage:  node simulate-order.js  [--type=B2B|B2C]
//   (make sure `npm run dev` is running in another terminal first)

const API_URL = process.env.API_URL || 'http://localhost:5000';

const individualsOrders = [
  { cust: 'Kavya Menon', type: 'B2C', email: 'kavya.menon@gmail.com', address: '19 Palm Grove, Kochi, KL 682020',
    lines: [{ p: 'Garm Polo', size: 'M', color: 'White', qty: 2, unit: 250 }] },
  { cust: 'Sahil Kapoor', type: 'B2C', email: 'sahil.kapoor@yahoo.com', address: '7 Sector 21, Chandigarh, PB 160022',
    lines: [{ p: 'Garm Shirt', size: 'L', color: 'Black', qty: 1, unit: 250 }] },
];

const organizationOrders = [
  { cust: 'Zenith Logistics', type: 'B2B', email: 'procurement@zenithlogistics.com', address: 'Plot 9, Logistics Park, Pune, MH 411057',
    lines: [{ p: 'Garm Corporate Blazer', size: 'L', color: 'Navy', qty: 30, unit: 1450 }] },
  { cust: 'Trishul Sportswear', type: 'B2B', email: 'orders@trishulsports.com', address: 'Sector 5, Industrial Estate, Ludhiana, PB 141003',
    lines: [{ p: 'Garm Track Jacket', size: 'M', color: 'Grey', qty: 150, unit: 225 }] },
];

const typeArg = process.argv.find((a) => a.startsWith('--type='))?.split('=')[1];
const pool = typeArg === 'B2B' ? organizationOrders : typeArg === 'B2C' ? individualsOrders : [...individualsOrders, ...organizationOrders];
const order = pool[Math.floor(Math.random() * pool.length)];

const res = await fetch(`${API_URL}/api/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order),
}).catch((err) => {
  console.error(`Could not reach backend at ${API_URL}. Is 'npm run dev' running in server/?`);
  console.error(err.message);
  process.exit(1);
});

const created = await res.json();
console.log('Order placed on the (simulated) Garm App:');
console.log(`  ${created.no} — ${created.cust} (${created.type}) — ₹${created.total.toLocaleString('en-IN')}`);
console.log('Check the admin Dashboard — it should show up instantly via WebSocket, no refresh.');
