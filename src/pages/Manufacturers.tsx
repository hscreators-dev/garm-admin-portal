import { useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ChartCanvas from '../components/ChartCanvas';
import { useToast } from '../components/Toast';
import { useManufacturers } from '../api/useManufacturers';
import { useOrders } from '../api/useOrders';
import { genTrend, formatINR, type Manufacturer } from '../data/mockData';

export default function Manufacturers() {
  const { manufacturers, loading } = useManufacturers();
  const [selected, setSelected] = useState<Manufacturer | null>(null);
  if (loading) return <div className="small-muted" style={{ padding: 24 }}>Loading manufacturers from the backend…</div>;
  return selected ? <MfrDetail mfr={selected} onBack={() => setSelected(null)} /> : <MfrList manufacturers={manufacturers} onOpen={setSelected} />;
}

function MfrList({ manufacturers, onOpen }: { manufacturers: Manufacturer[]; onOpen: (m: Manufacturer) => void }) {
  const showToast = useToast();
  const [modal, setModal] = useState(false);

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Manufacturers</div><div className="page-desc">Registry and performance of manufacturing partners.</div></div>
        <div className="page-actions"><button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" /> Add Manufacturer</button></div>
      </div>
      <div className="filter-bar">
        <div className="search-inline"><Icon name="search" /><input placeholder="Search name, city, email…" /></div>
        <select className="field-sm"><option>All statuses</option><option>Active</option><option>On Hold</option><option>Inactive</option></select>
        <select className="field-sm"><option>All categories</option><option>Shirts</option><option>Pants</option><option>Accessories</option></select>
        <select className="field-sm"><option>All cities</option><option>Tiruppur</option><option>Ludhiana</option><option>Surat</option></select>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>City</th><th>Categories</th><th>Capacity/mo</th><th>Lead time</th><th>On-time</th><th>QC pass</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {manufacturers.map((m) => (
              <tr className="clickable" key={m.id} onClick={() => onOpen(m)}>
                <td className="cust-name">{m.name}</td>
                <td>{m.city}</td>
                <td><div className="chip-list">{m.cats.map((c) => <span className="tag" key={c}>{c}</span>)}</div></td>
                <td>{m.cap.toLocaleString('en-IN')}</td>
                <td>{m.lead} days</td>
                <td>{m.onTime}%</td>
                <td>{m.qc}%</td>
                <td><Badge status={m.status} /></td>
                <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn btn-sm" style={{ width: 36, height: 36 }} onClick={() => onOpen(m)}><Icon name="eye" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modal} title="Add Manufacturer" onClose={() => setModal(false)} onConfirm={() => showToast('Add Manufacturer saved')}>
        <div className="form-grid">
          <div className="form-field"><label>Manufacturer name</label><input placeholder="e.g. Silverline Textiles" /></div>
          <div className="form-field"><label>Contact person</label><input placeholder="Full name" /></div>
          <div className="form-field"><label>Email</label><input type="email" placeholder="contact@company.com" /></div>
          <div className="form-field"><label>Phone</label><input placeholder="+91" /></div>
          <div className="form-field"><label>City</label><input placeholder="City, State" /></div>
          <div className="form-field"><label>Categories</label><select><option>Shirts</option><option>Pants</option><option>Accessories</option></select></div>
          <div className="form-field"><label>Capacity (units/mo)</label><input type="number" placeholder="5000" /></div>
          <div className="form-field"><label>Lead time (days)</label><input type="number" placeholder="7" /></div>
          <div className="form-field"><label>Per-unit cost (₹)</label><input type="number" placeholder="180" /></div>
          <div className="form-field"><label>Minimum order qty</label><input type="number" placeholder="50" /></div>
        </div>
      </Modal>

    </div>
  );
}

function MfrDetail({ mfr, onBack }: { mfr: Manufacturer; onBack: () => void }) {
  const showToast = useToast();
  const { orders } = useOrders();
  const mfrOrders = orders.filter((o) => o.mfr === mfr.name);
  const recent = mfrOrders.slice(0, 6);
  // Real manufacturer-payment totals from the orders assigned to this maker.
  const mfrBilled = mfrOrders.reduce((s, o) => s + (o.mfrBillAmount || 0), 0);
  const mfrPaid = mfrOrders.reduce((s, o) => s + (o.mfrPaidAmount || 0), 0);
  const mfrOutstanding = Math.max(0, mfrBilled - mfrPaid);
  const paymentRows = mfrOrders.filter((o) => (o.mfrBillAmount || 0) > 0 || (o.mfrPaidAmount || 0) > 0).slice(0, 8);
  const [editModal, setEditModal] = useState(false);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [form, setForm] = useState({ name: mfr.name, city: mfr.city, cap: mfr.cap, lead: mfr.lead, status: mfr.status });

  async function saveEdit() {
    try {
      const { api } = await import('../api/client');
      await api.updateManufacturer(mfr.id, { name: form.name, city: form.city, cap: Number(form.cap) || 0, lead: Number(form.lead) || 0, status: form.status });
      showToast(`${form.name} updated`);
    } catch (err) {
      showToast(`Could not save: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <div className="back-btn" onClick={onBack}><Icon name="arrowLeft" /> Back to Manufacturers</div>
      <div className="detail-header">
        <div className="detail-title">{mfr.name}</div>
        <span className="badge tone-success"><span className="dot"></span>Verified</span>
        <Badge status={mfr.status} />
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-outline btn-sm" onClick={() => setEditModal(true)}><Icon name="edit" /> Edit</button>
        <button className="btn btn-outline btn-sm" onClick={() => setShowAllOrders(true)}><Icon name="package" /> View Orders ({mfrOrders.length})</button>
      </div>
      <div className="two-col">
        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '13.5px' }}>Performance Dashboard</h3>
            <div className="grid grid-4" style={{ marginBottom: 14 }}>
              <div className="perf-tile"><div className="pv">312</div><div className="pl">Total Orders</div></div>
              <div className="perf-tile"><div className="pv">288</div><div className="pl">Completed</div></div>
              <div className="perf-tile"><div className="pv">{mfr.onTime}%</div><div className="pl">On-time Rate</div></div>
              <div className="perf-tile"><div className="pv">{mfr.qc}%</div><div className="pl">QC Pass Rate</div></div>
            </div>
            <ChartCanvas
              height={90}
              config={{
                type: 'line',
                data: {
                  labels: Array.from({ length: 12 }, (_, i) => `Wk${i + 1}`),
                  datasets: [{ label: 'On-time %', data: genTrend(mfr.onTime, 12), borderColor: '#0D0D0D', backgroundColor: 'rgba(200,169,126,.16)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2 }],
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 60, max: 100, ticks: { callback: (v) => v + '%' } }, x: { grid: { display: false } } } },
              }}
            />
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Recent Orders</h3>
            <table className="table">
              <thead><tr><th>Order #</th><th>Customer</th><th>Qty</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {recent.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>No recent orders</td></tr>}
                {recent.map((o) => (
                  <tr key={o.id}><td className="tnum">{o.no}</td><td>{o.cust}</td><td>{o.qty}</td><td><Badge status={o.status} /></td><td>{o.date}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Basic Info</h3>
            <div className="info-row"><span className="k">Contact person</span><span className="v">Ravi Kumar</span></div>
            <div className="info-row"><span className="k">Email</span><span className="v">contact@{mfr.name.toLowerCase().replace(/\s+/g, '')}.in</span></div>
            <div className="info-row"><span className="k">Phone</span><span className="v">+91 98765 43210</span></div>
            <div className="info-row"><span className="k">City</span><span className="v">{mfr.city}</span></div>
            <div className="info-row"><span className="k">Certifications</span><span className="v"><span className="chip-list">{mfr.certs.length ? mfr.certs.map((c) => <span className="tag" key={c}>{c}</span>) : '—'}</span></span></div>
          </div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Rates &amp; Capacity</h3>
            <div className="info-row"><span className="k">Per-unit cost</span><span className="v">₹180</span></div>
            <div className="info-row"><span className="k">Min. order qty</span><span className="v">50 units</span></div>
            <div className="info-row"><span className="k">Capacity / month</span><span className="v">{mfr.cap.toLocaleString('en-IN')} units</span></div>
            <div className="info-row"><span className="k">Lead time</span><span className="v">{mfr.lead} days</span></div>
            <div className="info-row"><span className="k">Payment terms</span><span className="v">50% advance</span></div>
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Manufacturer Payments</h3>
            <div className="info-row"><span className="k">Total billed</span><span className="v">{formatINR(mfrBilled)}</span></div>
            <div className="info-row"><span className="k">Total paid</span><span className="v" style={{ color: '#047857', fontWeight: 600 }}>{formatINR(mfrPaid)}</span></div>
            <div className="info-row"><span className="k">Outstanding</span><span className="v" style={{ color: mfrOutstanding > 0 ? '#dc2626' : 'inherit', fontWeight: 600 }}>{formatINR(mfrOutstanding)}</span></div>
            <hr className="sep" style={{ margin: '8px 0' }} />
            {paymentRows.length === 0 ? (
              <div className="small-muted" style={{ fontSize: 12 }}>No bills recorded yet. Open an order assigned to this manufacturer → Manufacturer Payment to set the bill and record payments.</div>
            ) : paymentRows.map((o) => (
              <div className="info-row" key={o.id}>
                <span className="k">{o.no}{o.mfrBillAmount ? ` · ${formatINR(o.mfrPaidAmount || 0)}/${formatINR(o.mfrBillAmount)}` : ''}</span>
                <span className="v"><Badge status={o.mfrPayStatus || 'PENDING'} /></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={editModal} title={`Edit ${mfr.name}`} confirmLabel="Save Changes" onClose={() => setEditModal(false)} onConfirm={saveEdit}>
        <div className="form-grid">
          <div className="form-field"><label>Manufacturer name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-field"><label>City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
          <div className="form-field"><label>Capacity (units/mo)</label><input type="number" value={form.cap} onChange={(e) => setForm({ ...form, cap: Number(e.target.value) })} /></div>
          <div className="form-field"><label>Lead time (days)</label><input type="number" value={form.lead} onChange={(e) => setForm({ ...form, lead: Number(e.target.value) })} /></div>
          <div className="form-field full"><label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Manufacturer['status'] })}>
              <option value="ACTIVE">ACTIVE</option><option value="ON_HOLD">ON_HOLD</option><option value="INACTIVE">INACTIVE</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal open={showAllOrders} title={`Orders with ${mfr.name} (${mfrOrders.length})`} confirmLabel="Close" onClose={() => setShowAllOrders(false)} onConfirm={() => setShowAllOrders(false)}>
        <table className="table">
          <thead><tr><th>Order #</th><th>Customer</th><th>Qty</th><th>Status</th><th>Payment</th><th>Date</th></tr></thead>
          <tbody>
            {mfrOrders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 16 }}>No orders assigned to this manufacturer yet.</td></tr>}
            {mfrOrders.map((o) => (
              <tr key={o.id}><td className="tnum">{o.no}</td><td>{o.cust}</td><td>{o.qty}</td><td><Badge status={o.status} /></td><td><Badge status={o.pay} /></td><td>{o.date}</td></tr>
            ))}
          </tbody>
        </table>
      </Modal>
    </div>
  );
}
