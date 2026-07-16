import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { formatINR, type Order } from '../data/mockData';
import Icon from '../components/Icon';

type LoginEvent = {
  id: string; userId: string; name: string; phone: string; email: string;
  mode: 'phone' | 'email'; isNewUser: boolean; at: string;
};
type Counts = {
  totalLogins: number; newLogins: number; returningLogins: number;
  todayTotal: number; todayNew: number; todayReturning: number; uniqueCustomers: number;
};
interface AppCustomer {
  id: string; name: string; phone: string; email: string;
  accountType: 'B2C' | 'B2B'; orgName: string | null; orgType: string | null;
  onboarded: boolean; registeredAt: string | null;
  orders: number; spend: number; lastOrderAt: string | null;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function CustomerLog() {
  const [customers, setCustomers] = useState<AppCustomer[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'B2C' | 'B2B'>('ALL');
  const [search, setSearch] = useState('');

  // Drill-in: the selected customer + their orders.
  const [selected, setSelected] = useState<AppCustomer | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const load = () => Promise.all([
    api.getCustomers().then((d) => setCustomers(d.customers)).catch(() => {}),
    api.getCustomerLog().then((d) => { setCounts(d.counts); setEvents(d.events); }).catch(() => {}),
  ]).finally(() => setLoading(false));

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  // Latest login per customer (userId → most recent event) for a "last seen" +
  // new/returning signal on each row.
  const loginByUser = useMemo(() => {
    const m = new Map<string, LoginEvent>();
    for (const e of events) if (!m.has(e.userId)) m.set(e.userId, e); // events come newest-first
    return m;
  }, [events]);

  function openCustomer(c: AppCustomer) {
    setSelected(c);
    setOrders(null);
    setOrdersLoading(true);
    api.getCustomerOrders(c.id)
      .then((d) => setOrders(d.orders))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }

  const q = search.trim().toLowerCase();
  const visible = customers.filter((c) =>
    (tab === 'ALL' || c.accountType === tab) &&
    (!q || c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
      || c.email.toLowerCase().includes(q) || (c.orgName || '').toLowerCase().includes(q))
  );

  const card: React.CSSProperties = { flex: 1, minWidth: 150 };

  // ── Drill-in view: one customer's orders ──────────────────────────────────
  if (selected) {
    return (
      <div style={{ padding: 24 }}>
        <button className="btn btn-outline btn-sm" style={{ marginBottom: 12 }} onClick={() => setSelected(null)}>
          <Icon name="search" /> Back to customers
        </button>
        <h1 style={{ margin: '0 0 2px' }}>{selected.orgName || selected.name}</h1>
        <p className="small-muted" style={{ margin: '0 0 14px' }}>
          {selected.phone || '—'}{selected.email ? ` · ${selected.email}` : ''} · {selected.accountType === 'B2B' ? 'Organisation' : 'Individual'}
          {' · '}{selected.orders} order{selected.orders === 1 ? '' : 's'} · {formatINR(selected.spend || 0)} spent
        </p>

        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Order #</th><th>Product</th><th>Pieces</th><th>Total</th><th>Status</th><th>Payment</th><th>Date</th></tr>
            </thead>
            <tbody>
              {ordersLoading && <tr><td colSpan={7} className="small-muted" style={{ padding: 16 }}>Loading orders…</td></tr>}
              {!ordersLoading && orders && orders.length === 0 && (
                <tr><td colSpan={7} className="small-muted" style={{ padding: 16 }}>This customer hasn’t placed any orders yet.</td></tr>
              )}
              {!ordersLoading && orders && orders.map((o) => {
                const product = o.garmentType || o.serviceLabel || (o.lines && o.lines[0]?.p) || (o.isAccessoryOrder ? 'Accessories' : 'Custom order');
                return (
                  <tr key={o.id}>
                    <td>{o.orderRef || `#${o.id}`}</td>
                    <td>{product}{o.fabric ? <span className="small-muted"> · {o.fabric}</span> : ''}</td>
                    <td>{o.qty || 0}</td>
                    <td>{formatINR(o.total || o.quoteAmount || 0)}</td>
                    <td>{o.status || '—'}</td>
                    <td>{o.pay || o.paymentStatus || '—'}</td>
                    <td className="small-muted">{o.date || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Main view: customers + login summary ──────────────────────────────────
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 4px' }}>Customer Log</h1>
      <p className="small-muted" style={{ margin: '0 0 16px' }}>
        Every Garm App account — registered number/email, sign-in activity, and orders. Click a customer to see what they ordered.
      </p>

      {/* Login summary */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="card card-pad" style={card}>
          <div className="small-muted">New logins today</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#047857' }}>{counts?.todayNew ?? '—'}</div>
        </div>
        <div className="card card-pad" style={card}>
          <div className="small-muted">Returning logins today</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1a4a8a' }}>{counts?.todayReturning ?? '—'}</div>
        </div>
        <div className="card card-pad" style={card}>
          <div className="small-muted">Total customers</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{customers.length || (counts?.uniqueCustomers ?? '—')}</div>
        </div>
        <div className="card card-pad" style={card}>
          <div className="small-muted">All-time logins</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{counts?.totalLogins ?? '—'}</div>
        </div>
      </div>

      {/* Filter + search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['ALL', 'B2C', 'B2B'] as const).map((t) => (
          <button key={t} className={tab === t ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setTab(t)}>
            {t === 'ALL' ? 'All' : t === 'B2C' ? 'Individuals' : 'Organisations'}
          </button>
        ))}
        <div className="search-inline" style={{ marginLeft: 'auto' }}>
          <Icon name="search" />
          <input placeholder="Search name / phone / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Customer table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Customer</th><th>Phone</th><th>Email</th><th>Type</th><th>Orders</th><th>Spend</th><th>Last seen</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="small-muted" style={{ padding: 16 }}>Loading…</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={8} className="small-muted" style={{ padding: 16 }}>No customers yet.</td></tr>}
            {visible.map((c) => {
              const ev = loginByUser.get(c.id);
              return (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openCustomer(c)}>
                  <td>{c.orgName || c.name || <span className="small-muted">(not onboarded)</span>}</td>
                  <td>{c.phone || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>{c.accountType === 'B2B' ? 'Organisation' : 'Individual'}</td>
                  <td>{c.orders}</td>
                  <td>{formatINR(c.spend || 0)}</td>
                  <td className="small-muted">{ev ? timeAgo(ev.at) : timeAgo(c.lastOrderAt)}</td>
                  <td>
                    <span className="badge" style={{
                      background: c.onboarded ? '#ECFDF5' : '#FEF3F2',
                      color: c.onboarded ? '#047857' : '#b42318',
                      padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                    }}>{c.onboarded ? 'Registered' : 'Not onboarded'}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
