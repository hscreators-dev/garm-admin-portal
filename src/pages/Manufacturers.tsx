import { useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import ChartCanvas from '../components/ChartCanvas';
import { useToast } from '../components/Toast';
import { genTrend, manufacturersData, ordersData, type Manufacturer } from '../data/mockData';

export default function Manufacturers() {
  const [selected, setSelected] = useState<Manufacturer | null>(null);
  return selected ? <MfrDetail mfr={selected} onBack={() => setSelected(null)} /> : <MfrList onOpen={setSelected} />;
}

function MfrList({ onOpen }: { onOpen: (m: Manufacturer) => void }) {
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
            {manufacturersData.map((m) => (
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
                  <button className="icon-btn btn-sm" style={{ width: 30, height: 30 }} onClick={() => onOpen(m)}><Icon name="eye" /></button>
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
  const recent = ordersData.filter((o) => o.mfr === mfr.name).slice(0, 6);

  return (
    <div>
      <div className="back-btn" onClick={onBack}><Icon name="arrowLeft" /> Back to Manufacturers</div>
      <div className="detail-header">
        <div className="detail-title">{mfr.name}</div>
        <span className="badge tone-success"><span className="dot"></span>Verified</span>
        <Badge status={mfr.status} />
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-outline btn-sm"><Icon name="edit" /> Edit</button>
        <button className="btn btn-outline btn-sm"><Icon name="package" /> View Orders</button>
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
                  datasets: [{ label: 'On-time %', data: genTrend(mfr.onTime, 12), borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.08)', tension: 0.35, fill: true, pointRadius: 0, borderWidth: 2 }],
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
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Payment History</h3>
            <div className="info-row"><span className="k">INV-0392 · Jun 28</span><span className="v"><span className="badge tone-success">PAID</span></span></div>
            <div className="info-row"><span className="k">INV-0381 · Jun 14</span><span className="v"><span className="badge tone-success">PAID</span></span></div>
            <div className="info-row"><span className="k">INV-0370 · May 30</span><span className="v"><span className="badge tone-warning">PARTIAL</span></span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
