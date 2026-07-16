import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import ChartCanvas from '../components/ChartCanvas';
import { useToast } from '../components/Toast';
import { useOrders } from '../api/useOrders';
import { api } from '../api/client';
import { QC_TEMPLATES, type Order } from '../data/mockData';

// Individuals (B2C) skip in-house QC entirely in the Garm App — only
// Organization (B2B) manufacturing runs are inspected before invoicing. This
// module only ever operates on B2B orders; see server/index.js's
// buildTrackSteps()/the QC_READY|QC_APPROVED status guard for the backend side.
export default function QC() {
  const { orders, loading, refresh } = useOrders();
  const [inspecting, setInspecting] = useState<Order | null>(null);

  if (loading) return <div className="small-muted" style={{ padding: 24 }}>Loading QC queue from the backend…</div>;

  return inspecting ? (
    <QcForm order={inspecting} onBack={() => { setInspecting(null); refresh(); }} />
  ) : (
    <QcQueue orders={orders} onStart={setInspecting} />
  );
}

function QcQueue({ orders, onStart }: { orders: Order[]; onStart: (o: Order) => void }) {
  // QC now covers BOTH Organisation and Individual orders — every production run
  // is inspected after it returns from the manufacturer, before shipping.
  const orgOrders = useMemo(() => orders, [orders]);
  const pending = orgOrders.filter((o) => o.status === 'QC_READY');
  const inspected = orgOrders.filter((o) => o.qc === 'PASSED' || o.qc === 'FAILED' || o.qc === 'REWORK');
  const passRate = inspected.length ? Math.round((inspected.filter((o) => o.qc === 'PASSED').length / inspected.length) * 100) : 0;
  const failRate = inspected.length ? Math.round((inspected.filter((o) => o.qc === 'FAILED').length / inspected.length) * 100) : 0;
  const reworkRate = inspected.length ? Math.round((inspected.filter((o) => o.qc === 'REWORK').length / inspected.length) * 100) : 0;

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Quality Control</div><div className="page-desc">Inspection queue and QC performance — Organization orders only. Individuals skip QC in the Garm App.</div></div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="card kpi"><div className="kpi-label">Total Inspected</div><div className="kpi-value">{inspected.length}</div></div>
        <div className="card kpi"><div className="kpi-label">Pass Rate</div><div className="kpi-value" style={{ color: 'var(--success)' }}>{passRate}%</div></div>
        <div className="card kpi"><div className="kpi-label">Fail Rate</div><div className="kpi-value" style={{ color: 'var(--danger)' }}>{failRate}%</div></div>
        <div className="card kpi"><div className="kpi-label">Rework Rate</div><div className="kpi-value" style={{ color: 'var(--warning)' }}>{reworkRate}%</div></div>
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><h3>Pass Rate Trend</h3></div>
          <div className="card-pad">
            <ChartCanvas
              height={90}
              config={{
                type: 'line',
                data: {
                  labels: Array.from({ length: 10 }, (_, i) => `D${i * 3 + 1}`),
                  datasets: [{ label: 'Pass rate', data: [88,90,89,91,93,92,94,91,93,92], borderColor: '#059669', backgroundColor: 'rgba(5,150,105,.08)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2.5 }],
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 70, max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#f1f3f7' } }, x: { grid: { display: false } } } },
              }}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Inspector Performance</h3></div>
          <table className="table">
            <thead><tr><th>Inspector</th><th>Inspections</th><th>Pass %</th></tr></thead>
            <tbody>
              <tr><td>Meena R.</td><td>62</td><td><span className="badge tone-success">94%</span></td></tr>
              <tr><td>Arjun S.</td><td>58</td><td><span className="badge tone-success">91%</span></td></tr>
              <tr><td>Priya D.</td><td>66</td><td><span className="badge tone-warning">88%</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>QC Pending Queue</h3>
          <span className="badge tone-warning"><span className="dot"></span>{pending.length} awaiting inspection</span>
        </div>
        <table className="table">
          <thead><tr><th>Order #</th><th>Manufacturer</th><th>Item type</th><th>Qty</th><th>Ready since</th><th>Inspector</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
          <tbody>
            {pending.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>Queue is clear — nothing pending inspection.</td></tr>}
            {pending.map((o) => (
              <tr key={o.id}>
                <td className="tnum">{o.no}</td><td>{o.mfr}</td><td>{o.lines[0]?.p ?? '—'}</td><td>{o.qty}</td><td>{o.date}</td><td>Unassigned</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => onStart(o)}><Icon name="shieldSm" /> Start Inspection</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QcForm({ order, onBack }: { order: Order; onBack: () => void }) {
  const showToast = useToast();
  const template = QC_TEMPLATES['Shirts'];
  const [results, setResults] = useState<Record<number, 'pass' | 'fail'>>(() =>
    Object.fromEntries(template.map((_, i) => [i, 'pass' as const]))
  );
  const [overall, setOverall] = useState<'pass' | 'fail' | 'rework' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!overall) { showToast('Select an overall result before submitting'); return; }
    setSubmitting(true);
    try {
      if (overall === 'pass') {
        await api.updateOrderStatus(order.id, { status: 'QC_APPROVED', qc: 'PASSED' });
        showToast('QC passed — order marked QC Approved, ready to invoice.');
      } else if (overall === 'fail') {
        await api.updateOrderStatus(order.id, { status: 'IN_PROGRESS', qc: 'FAILED' });
        showToast('QC failed — sent back to manufacturer for rework.');
      } else {
        await api.updateOrderStatus(order.id, { status: 'IN_PROGRESS', qc: 'REWORK' });
        showToast('Rework requested — manufacturer notified.');
      }
      onBack();
    } catch (err) {
      showToast(`Couldn't save inspection: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="back-btn" onClick={onBack}><Icon name="arrowLeft" /> Back to QC Queue</div>
      <div className="detail-header">
        <div className="detail-title">Inspection — {order.no}</div>
        <span className="badge tone-slate">Shirts · Qty {order.qty}</span>
      </div>

      <div className="two-col">
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 4px', fontSize: '13.5px' }}>Checklist — Shirts</h3>
          <div className="small-muted" style={{ marginBottom: 8 }}>Mark each item Pass or Fail. Add notes for any failures.</div>
          <div>
            {template.map((name, i) => (
              <div className="checklist-item" key={i}>
                <div className="checklist-name">{name}</div>
                <div className="pf-toggle">
                  <button className={`pf-btn pass ${results[i] === 'pass' ? 'active' : ''}`} onClick={() => setResults((r) => ({ ...r, [i]: 'pass' }))}>Pass</button>
                  <button className={`pf-btn fail ${results[i] === 'fail' ? 'active' : ''}`} onClick={() => setResults((r) => ({ ...r, [i]: 'fail' }))}>Fail</button>
                </div>
                <input className="mini-input" placeholder="Notes (optional)" />
                <button className="photo-btn" onClick={() => showToast('Photo attached')}><Icon name="upload" /></button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Overall Result</h3>
            <div className="result-choice">
              <div className={`result-opt sel-pass ${overall === 'pass' ? 'active' : ''}`} onClick={() => setOverall('pass')}><Icon name="checkCircle" /><div>Pass</div></div>
              <div className={`result-opt sel-fail ${overall === 'fail' ? 'active' : ''}`} onClick={() => setOverall('fail')}><Icon name="xCircle" /><div>Fail</div></div>
              <div className={`result-opt sel-rework ${overall === 'rework' ? 'active' : ''}`} onClick={() => setOverall('rework')}><Icon name="repeat" /><div>Rework</div></div>
            </div>
          </div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '13.5px' }}>Overall Notes</h3>
            <textarea className="ta" placeholder="General inspection comments…"></textarea>
          </div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '13.5px' }}>Photos</h3>
            <div className="dropzone"><Icon name="upload" /><div>Drag photos here or click to upload</div></div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting} onClick={submit}><Icon name="check" /> {submitting ? 'Saving…' : 'Submit Inspection'}</button>
        </div>
      </div>
    </div>
  );
}
