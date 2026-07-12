import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import ChartCanvas from '../components/ChartCanvas';
import AudienceTabs, { type AudienceFilter } from '../components/AudienceTabs';
import { useToast } from '../components/Toast';
import { useOrders } from '../api/useOrders';
import { formatINR, manufacturersData, type Order } from '../data/mockData';

const TABS = ['Revenue', 'Orders', 'QC', 'Manufacturer', 'Custom Builder'];

export default function Reports() {
  const showToast = useToast();
  const [tab, setTab] = useState(0);
  const { orders } = useOrders();
  const [audience, setAudience] = useState<AudienceFilter>('ALL');

  // Live numbers from the shared order book, scoped by customer type.
  const scoped = useMemo(() => orders.filter((o) => audience === 'ALL' || o.type === audience), [orders, audience]);
  const amount = (o: Order) => o.total || o.quoteAmount || 0;
  const activeOrders = scoped.filter((o) => o.status !== 'CANCELLED');
  const revenue = activeOrders.filter((o) => o.pay === 'COMPLETED').reduce((s, o) => s + amount(o), 0);
  const aov = activeOrders.length ? Math.round(activeOrders.reduce((s, o) => s + amount(o), 0) / activeOrders.length) : 0;
  const cancelRate = scoped.length ? Math.round((scoped.filter((o) => o.status === 'CANCELLED').length / scoped.length) * 100) : 0;
  const b2bRevenue = orders.filter((o) => o.type === 'B2B' && o.status !== 'CANCELLED').reduce((s, o) => s + amount(o), 0);
  const b2cRevenue = orders.filter((o) => o.type === 'B2C' && o.status !== 'CANCELLED').reduce((s, o) => s + amount(o), 0);
  const topCustomers = useMemo(() => {
    const byCust = new Map<string, { type: string; count: number; revenue: number }>();
    for (const o of activeOrders) {
      const e = byCust.get(o.cust) || { type: o.type, count: 0, revenue: 0 };
      e.count += 1; e.revenue += amount(o);
      byCust.set(o.cust, e);
    }
    return [...byCust.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped]);
  const statusLabels = ['New', 'Confirmed', 'Paid', 'Assigned', 'In Progress', 'QC', 'Invoiced', 'Shipped', 'Delivered', 'Cancelled'];
  const statusData = [
    scoped.filter((o) => o.status === 'NEW').length,
    scoped.filter((o) => o.status === 'CONFIRMED').length,
    scoped.filter((o) => o.status === 'PAID').length,
    scoped.filter((o) => o.status === 'ASSIGNED').length,
    scoped.filter((o) => o.status === 'IN_PROGRESS').length,
    scoped.filter((o) => ['QC_READY', 'QC_APPROVED'].includes(o.status)).length,
    scoped.filter((o) => o.status === 'INVOICED').length,
    scoped.filter((o) => o.status === 'SHIPPED').length,
    scoped.filter((o) => o.status === 'DELIVERED').length,
    scoped.filter((o) => o.status === 'CANCELLED').length,
  ];

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Reports &amp; Analytics</div><div className="page-desc">Business insights across revenue, orders, QC and manufacturers.</div></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => showToast('Report exported as Excel')}><Icon name="download" /> Export Excel</button>
          <button className="btn btn-outline" onClick={() => showToast('Report exported as PDF')}><Icon name="printer" /> Export PDF</button>
        </div>
      </div>
      <AudienceTabs value={audience} onChange={setAudience} showAll
        counts={{ b2c: orders.filter((o) => o.type === 'B2C').length, b2b: orders.filter((o) => o.type === 'B2B').length }} />

      <div className="tabs">
        {TABS.map((t, i) => <div className={`tab ${tab === i ? 'active' : ''}`} key={t} onClick={() => setTab(i)}>{t}</div>)}
      </div>

      {tab === 0 && (
        <div>
          <div className="two-col" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="card-head"><h3>Revenue Trend (12 mo)</h3></div>
              <div className="card-pad">
                <ChartCanvas
                  height={90}
                  config={{
                    type: 'bar',
                    data: { labels: ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'], datasets: [{ data: [142,151,168,159,180,172,195,201,214,208,231,245].map(v => v * 1000), backgroundColor: '#0D0D0D', borderRadius: 5, barThickness: 14 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => '₹' + (Number(v) / 1000) + 'k' }, grid: { color: '#f1f3f7' } }, x: { grid: { display: false } } } },
                  }}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>Organizations vs Individuals (live order value)</h3></div>
              <div className="card-pad">
                <ChartCanvas
                  key={`split-${b2bRevenue}-${b2cRevenue}`}
                  height={90}
                  config={{
                    type: 'doughnut',
                    data: { labels: ['Organizations', 'Individuals'], datasets: [{ data: [b2bRevenue || 0, b2cRevenue || 0], backgroundColor: ['#0D0D0D', '#C8A97E'], borderWidth: 0 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '68%' },
                  }}
                />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Top Customers by Order Value (live)</h3></div>
            <table className="table">
              <thead><tr><th>Customer</th><th>Type</th><th>Orders</th><th>Order value</th></tr></thead>
              <tbody>
                {topCustomers.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>No orders yet.</td></tr>}
                {topCustomers.map(([cust, e]) => (
                  <tr key={cust}><td>{cust}</td><td><span className="tag">{e.type === 'B2C' ? 'Individual' : 'Organisation'}</span></td><td>{e.count}</td><td className="tnum">{formatINR(e.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="card kpi"><div className="kpi-label">Total Orders (live)</div><div className="kpi-value">{activeOrders.length}</div></div>
            <div className="card kpi"><div className="kpi-label">Avg Order Value</div><div className="kpi-value">{formatINR(aov)}</div></div>
            <div className="card kpi"><div className="kpi-label">Payments Collected</div><div className="kpi-value">{formatINR(revenue)}</div></div>
            <div className="card kpi"><div className="kpi-label">Cancellation Rate</div><div className="kpi-value">{cancelRate}%</div></div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Orders by Status (live)</h3></div>
            <div className="card-pad">
              <ChartCanvas
                key={`status-${audience}-${statusData.join('-')}`}
                height={90}
                config={{
                  type: 'bar',
                  data: { labels: statusLabels, datasets: [{ data: statusData, backgroundColor: '#2563eb', borderRadius: 5 }] },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f3f7' }, ticks: { precision: 0 } } } },
                }}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="two-col">
          <div className="card">
            <div className="card-head"><h3>Pass / Fail / Rework</h3></div>
            <div className="card-pad">
              <ChartCanvas
                height={90}
                config={{
                  type: 'doughnut',
                  data: { labels: ['Pass', 'Fail', 'Rework'], datasets: [{ data: [92, 5, 3], backgroundColor: ['#059669', '#dc2626', '#d97706'], borderWidth: 0 }] },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '68%' },
                }}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Most Common Failure Reasons</h3></div>
            <table className="table">
              <thead><tr><th>Reason</th><th>Count</th></tr></thead>
              <tbody>
                <tr><td>Seam quality</td><td>14</td></tr>
                <tr><td>Color mismatch</td><td>9</td></tr>
                <tr><td>Tag placement</td><td>6</td></tr>
                <tr><td>Fabric defects</td><td>4</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 3 && (
        <div className="card">
          <div className="card-head"><h3>Manufacturer Rankings</h3></div>
          <div className="card-pad">
            <ChartCanvas
              height={110}
              config={{
                type: 'bar',
                data: {
                  labels: manufacturersData.map((m) => m.name),
                  datasets: [
                    { label: 'On-time %', data: manufacturersData.map((m) => m.onTime), backgroundColor: '#0D0D0D', borderRadius: 5, barThickness: 14 },
                    { label: 'QC pass %', data: manufacturersData.map((m) => m.qc), backgroundColor: '#C8A97E', borderRadius: 5, barThickness: 14 },
                  ],
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { min: 0, max: 100, grid: { color: '#f1f3f7' } }, y: { grid: { display: false } } } },
              }}
            />
          </div>
        </div>
      )}

      {tab === 4 && (
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 14px', fontSize: 14 }}>Custom Report Builder</h3>
          <div className="form-grid">
            <div className="form-field"><label>Date range</label><select><option>This month</option><option>Last 3 months</option><option>Custom</option></select></div>
            <div className="form-field"><label>Manufacturer</label><select><option>All manufacturers</option>{manufacturersData.map((m) => <option key={m.id}>{m.name}</option>)}</select></div>
            <div className="form-field"><label>Customer type</label><select><option>All</option><option>B2B</option><option>B2C</option></select></div>
            <div className="form-field"><label>Status</label><select><option>All statuses</option></select></div>
            <div className="form-field full">
              <label>Metrics to include</label>
              <div className="chip-list">
                <label className="tag"><input type="checkbox" defaultChecked /> Revenue</label>
                <label className="tag"><input type="checkbox" defaultChecked /> Orders</label>
                <label className="tag"><input type="checkbox" /> QC Pass Rate</label>
                <label className="tag"><input type="checkbox" /> Avg Lead Time</label>
              </div>
            </div>
          </div>
          <div className="toggle-row" style={{ marginTop: 10 }}>
            <div><div className="t-name">Schedule recurring report</div><div className="t-desc">Email this report automatically</div></div>
            <label className="switch"><input type="checkbox" /><span className="slider"></span></label>
          </div>
          <div style={{ textAlign: 'right', marginTop: 14 }}>
            <button className="btn btn-primary" onClick={() => showToast('Custom report generated')}><Icon name="bar" /> Generate Report</button>
          </div>
        </div>
      )}
    </div>
  );
}
