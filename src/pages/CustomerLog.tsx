import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { onLiveEvent } from '../api/liveBus';

type LoginEvent = {
  id: string; userId: string; name: string; phone: string; email: string;
  mode: 'phone' | 'email'; isNewUser: boolean; at: string;
};
type Counts = {
  totalLogins: number; newLogins: number; returningLogins: number;
  todayTotal: number; todayNew: number; todayReturning: number; uniqueCustomers: number;
};

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export default function CustomerLog() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'returning'>('all');

  const load = () => api.getCustomerLog()
    .then((d) => { setEvents(d.events); setCounts(d.counts); })
    .catch(() => {})
    .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // A new sign-in broadcasts nothing today, so also poll every 30s.
    const t = setInterval(load, 30_000);
    const off = onLiveEvent('order:created', () => load()); // cheap refresh hook
    return () => { clearInterval(t); off(); };
  }, []);

  const visible = events.filter((e) =>
    filter === 'all' ? true : filter === 'new' ? e.isNewUser : !e.isNewUser
  );

  const card: React.CSSProperties = { flex: 1, minWidth: 150 };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: '0 0 4px' }}>Customer Log</h1>
      <p className="small-muted" style={{ margin: '0 0 16px' }}>
        Every sign-in from the Garm App — brand-new accounts vs returning customers.
      </p>

      {/* Summary counts */}
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
          <div className="small-muted">Total logins today</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{counts?.todayTotal ?? '—'}</div>
        </div>
        <div className="card card-pad" style={card}>
          <div className="small-muted">Unique customers (all time)</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{counts?.uniqueCustomers ?? '—'}</div>
        </div>
      </div>

      {/* All-time split */}
      {counts && (
        <p className="small-muted" style={{ marginBottom: 12 }}>
          All time: {counts.totalLogins} logins — {counts.newLogins} new · {counts.returningLogins} returning
        </p>
      )}

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['all', 'new', 'returning'] as const).map((f) => (
          <button key={f}
            className={filter === f ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'new' ? 'New accounts' : 'Returning'}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Customer</th><th>Contact</th><th>Type</th><th>When</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="small-muted" style={{ padding: 16 }}>Loading…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={4} className="small-muted" style={{ padding: 16 }}>No sign-ins recorded yet.</td></tr>
            )}
            {visible.map((e) => (
              <tr key={e.id}>
                <td>{e.name || <span className="small-muted">(no name yet)</span>}</td>
                <td>{e.phone || e.email || '—'}</td>
                <td>
                  <span className="badge" style={{
                    background: e.isNewUser ? '#ECFDF5' : '#EFF6FF',
                    color: e.isNewUser ? '#047857' : '#1a4a8a',
                    padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  }}>
                    {e.isNewUser ? 'New account' : 'Returning'}
                  </span>
                </td>
                <td className="small-muted" title={new Date(e.at).toLocaleString()}>{timeAgo(e.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
