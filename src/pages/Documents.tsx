import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import AudienceTabs, { type AudienceFilter } from '../components/AudienceTabs';
import { useOrders } from '../api/useOrders';
import { type Order, type OrderDocument } from '../data/mockData';

// Real documents view — every file attached to an order across the platform:
// invoices/quotations/billing uploaded by the admin team (visible to the
// customer in the Garm App) and design/logo references uploaded by customers.
// Uploading happens on the order itself (Orders → open order → Documents).

const KIND_TABS = [
  { key: '', label: 'All documents' },
  { key: 'INVOICE', label: 'Invoices' },
  { key: 'QUOTATION', label: 'Quotations' },
  { key: 'BILLING', label: 'Billing' },
  { key: 'DESIGN', label: 'Customer designs' },
  { key: 'OTHER', label: 'Other' },
];

const KIND_LABELS: Record<string, string> = {
  INVOICE: 'Invoice', QUOTATION: 'Quotation', BILLING: 'Billing', DESIGN: 'Design / logo', OTHER: 'Document',
};

interface DocRow { doc: OrderDocument; order: Order; }

function downloadDataUrl(dataUrl: string, name: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
}

export default function Documents() {
  const navigate = useNavigate();
  const { orders, loading } = useOrders();
  const [audience, setAudience] = useState<AudienceFilter>('ALL');
  const [kind, setKind] = useState('');
  const [search, setSearch] = useState('');

  const allRows = useMemo<DocRow[]>(
    () => orders.flatMap((order) => (order.documents || []).map((doc) => ({ doc, order }))),
    [orders],
  );

  const rows = useMemo(() => allRows.filter(({ doc, order }) => {
    if (audience !== 'ALL' && order.type !== audience) return false;
    if (kind && doc.kind !== kind) return false;
    const q = search.toLowerCase();
    if (q && !(doc.name.toLowerCase().includes(q) || order.no.toLowerCase().includes(q) || order.cust.toLowerCase().includes(q))) return false;
    return true;
  }), [allRows, audience, kind, search]);

  if (loading) return <div className="small-muted" style={{ padding: 24 }}>Loading documents from the backend…</div>;

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Documents</div><div className="page-desc">Every file attached to an order — invoices, quotations, billing and customer design uploads.</div></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('/orders')}><Icon name="upload" /> Upload on an Order</button>
        </div>
      </div>

      <AudienceTabs value={audience} onChange={setAudience} showAll
        counts={{
          b2c: allRows.filter((r) => r.order.type === 'B2C').length,
          b2b: allRows.filter((r) => r.order.type === 'B2B').length,
        }} />

      <div className="tabs" style={{ marginBottom: 14 }}>
        {KIND_TABS.map((t) => (
          <div className={`tab ${kind === t.key ? 'active' : ''}`} key={t.key} onClick={() => setKind(t.key)}>{t.label}</div>
        ))}
      </div>

      <div className="filter-bar">
        <div className="search-inline"><Icon name="search" /><input placeholder="Search file, order #, customer…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Document</th><th>Type</th><th>Order #</th><th>Customer</th><th>Uploaded by</th><th>Date</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 26 }}>
                No documents yet. Open an order in the Orders menu to upload an invoice, quotation or billing document — it appears in the customer's Garm App instantly.
              </td></tr>
            )}
            {rows.map(({ doc, order }) => (
              <tr key={`${order.id}-${doc.id}`}>
                <td className="cust-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="file" /> {doc.name}</td>
                <td><span className="tag">{KIND_LABELS[doc.kind] || doc.kind}</span></td>
                <td className="tnum">{order.no}</td>
                <td><div className="cust-name">{order.cust}</div><div className="cust-sub">{order.type === 'B2C' ? 'Individual' : 'Organisation'}</div></td>
                <td>{doc.uploadedBy === 'admin' ? 'Garm team' : 'Customer'}</td>
                <td>{doc.createdAt || '—'}</td>
                <td className="row-actions">
                  <button className="icon-btn btn-sm" title="Download" style={{ width: 36, height: 36 }} onClick={() => downloadDataUrl(doc.dataUrl, doc.name)}><Icon name="download" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
