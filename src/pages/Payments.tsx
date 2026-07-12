import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import AudienceTabs, { type AudienceFilter } from '../components/AudienceTabs';
import { useOrders } from '../api/useOrders';
import { formatINR, type Order } from '../data/mockData';

// Real payments view — driven by the same live orders the Garm App writes to
// (customer UPI/card payments land here automatically via the shared
// database), split by Individuals / Organizations like every other menu.
export default function Payments() {
  const navigate = useNavigate();
  const { orders, loading } = useOrders();
  const [audience, setAudience] = useState<AudienceFilter>('B2C');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [receiptId, setReceiptId] = useState<number | null>(null);

  const scoped = useMemo(() => orders.filter((o) => (audience === 'ALL' || o.type === audience) && o.status !== 'CANCELLED'), [orders, audience]);
  const rows = useMemo(() => scoped.filter((o) => {
    const q = search.toLowerCase();
    if (q && !(o.no.toLowerCase().includes(q) || o.cust.toLowerCase().includes(q))) return false;
    if (status && o.pay !== status) return false;
    return true;
  }), [scoped, search, status]);
  const receipt = orders.find((o) => o.id === receiptId) || null;

  const paidAmount = (o: Order) => o.total || o.quoteAmount || 0;
  const collected = scoped.filter((o) => o.pay === 'COMPLETED').reduce((s, o) => s + paidAmount(o), 0);
  const partial = scoped.filter((o) => o.pay === 'PARTIAL').reduce((s, o) => s + paidAmount(o), 0);
  const pending = scoped.filter((o) => o.pay === 'PENDING').reduce((s, o) => s + paidAmount(o), 0);
  const awaitingConfirm = audience !== 'B2B' ? scoped.filter((o) => o.type === 'B2C' && o.status === 'NEW').length : 0;

  if (loading) return <div className="small-muted" style={{ padding: 24 }}>Loading payments from the backend…</div>;

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Payments</div><div className="page-desc">Live payment status per order — customer UPI/card payments from the Garm App appear here automatically.</div></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => navigate('/orders')}><Icon name="card" /> Record Offline Payment (via Orders)</button>
        </div>
      </div>

      <AudienceTabs value={audience} onChange={setAudience} showAll
        counts={{ b2c: orders.filter((o) => o.type === 'B2C').length, b2b: orders.filter((o) => o.type === 'B2B').length }} />

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="kpi-label">Collected</div><div className="kpi-value" style={{ color: 'var(--success)' }}>{formatINR(collected)}</div></div>
        <div className="card kpi"><div className="kpi-label">Partial</div><div className="kpi-value" style={{ color: 'var(--warning)' }}>{formatINR(partial)}</div></div>
        <div className="card kpi"><div className="kpi-label">Awaiting payment</div><div className="kpi-value" style={{ color: 'var(--danger)' }}>{formatINR(pending)}</div></div>
        <div className="card kpi"><div className="kpi-label">Awaiting confirmation</div><div className="kpi-value">{awaitingConfirm}</div></div>
      </div>

      <div className="filter-bar">
        <div className="search-inline"><Icon name="search" /><input placeholder="Search order #, customer…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select className="field-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All payment statuses</option><option>PENDING</option><option>PARTIAL</option><option>COMPLETED</option>
        </select>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Amount</th><th>Method</th><th>Payment</th><th>Paid on</th><th>Reference</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 26 }}>No payments match these filters.</td></tr>
            )}
            {rows.map((o) => (
              <tr key={o.id}>
                <td className="tnum">{o.no}</td>
                <td><div className="cust-name">{o.cust}</div><div className="cust-sub">{o.type === 'B2C' ? 'Individual' : (o.orgName || 'Organisation')}</div></td>
                <td className="tnum">{formatINR(paidAmount(o))}</td>
                <td>{o.paymentMode || '—'}</td>
                <td><Badge status={o.pay} /></td>
                <td>{o.paymentDate || '—'}</td>
                <td className="tnum">{o.paymentReference || '—'}</td>
                <td className="row-actions">
                  <button className="icon-btn btn-sm" title="View receipt" style={{ width: 36, height: 36 }} onClick={() => setReceiptId(o.id)}><Icon name="eye" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!receipt} title="Payment Receipt" confirmLabel="Print Receipt" onClose={() => setReceiptId(null)} onConfirm={() => window.print()}>
        {receipt && (
          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            <div className="info-row"><span className="k">Order</span><span className="v">{receipt.no}</span></div>
            <div className="info-row"><span className="k">Customer</span><span className="v">{receipt.cust}</span></div>
            <div className="info-row"><span className="k">Amount</span><span className="v">{formatINR(paidAmount(receipt))}</span></div>
            <div className="info-row"><span className="k">Method</span><span className="v">{receipt.paymentMode || '—'}</span></div>
            <div className="info-row"><span className="k">Status</span><span className="v"><Badge status={receipt.pay} /></span></div>
            <div className="info-row"><span className="k">Paid on</span><span className="v">{receipt.paymentDate || '—'}</span></div>
            <div className="info-row"><span className="k">Reference</span><span className="v">{receipt.paymentReference || '—'}</span></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
