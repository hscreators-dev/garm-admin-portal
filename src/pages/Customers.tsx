import { useEffect, useState } from 'react';
import { api } from '../api/client';
import AudienceTabs from '../components/AudienceTabs';
import Icon from '../components/Icon';
import { formatINR } from '../data/mockData';

// ─── Customers — every Garm App account (registered / signed in) ─────────────
// Individual and Organisation tabs, with order counts and spend pulled from the
// same MongoDB the app writes to. Read-only: this is the customer database view.

interface AppCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  accountType: 'B2C' | 'B2B';
  orgName: string | null;
  orgType: string | null;
  onboarded: boolean;
  registeredAt: string | null;
  orders: number;
  spend: number;
  lastOrderAt: string | null;
}

export default function Customers() {
  const [customers, setCustomers] = useState<AppCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'B2C' | 'B2B'>('B2C');
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getCustomers()
      .then((d) => setCustomers(d.customers))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const q = search.trim().toLowerCase();
  const visible = customers.filter((c) =>
    c.accountType === tab &&
    (!q || c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q) || (c.orgName || '').toLowerCase().includes(q)));

  const b2cCount = customers.filter((c) => c.accountType === 'B2C').length;
  const b2bCount = customers.filter((c) => c.accountType === 'B2B').length;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Customers</div>
          <div className="page-desc">Every account registered in the Garm App — {b2cCount} individuals · {b2bCount} organisations.</div>
        </div>
      </div>

      <AudienceTabs value={tab} onChange={(v) => { if (v !== 'ALL') setTab(v); }} />

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <input placeholder="Search name, phone, email, organisation…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 320, maxWidth: '100%' }} />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              {tab === 'B2B' && <th>Organisation</th>}
              <th>Phone</th>
              <th>Email</th>
              <th>Registered</th>
              <th>Orders</th>
              <th>Total spend</th>
              <th>Last order</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="small-muted" style={{ padding: 16 }}>Loading customers…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={8} className="small-muted" style={{ padding: 16 }}>
                No {tab === 'B2C' ? 'individual' : 'organisation'} accounts{q ? ' match this search' : ' yet — accounts appear here the moment someone signs in on the Garm App'}.
              </td></tr>
            )}
            {visible.map((c) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  {!c.onboarded && <div className="small-muted" style={{ fontSize: 11 }}>Signed in · onboarding not finished</div>}
                </td>
                {tab === 'B2B' && <td>{c.orgName || '—'}{c.orgType ? <div className="small-muted" style={{ fontSize: 11 }}>{c.orgType}</div> : null}</td>}
                <td>{c.phone || '—'}</td>
                <td>{c.email || '—'}</td>
                <td>{c.registeredAt || '—'}</td>
                <td>{c.orders}</td>
                <td>{c.spend ? formatINR(c.spend) : '—'}</td>
                <td>{c.lastOrderAt || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="small-muted" style={{ marginTop: 10 }}>
        <Icon name="shieldSm" /> Read-only. Contact details come from the customer's own profile in the Garm App.
      </div>
    </div>
  );
}
