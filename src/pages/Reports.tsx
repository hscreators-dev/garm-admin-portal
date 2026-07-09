import { useState } from 'react';
import Icon from '../components/Icon';
import ChartCanvas from '../components/ChartCanvas';
import { useToast } from '../components/Toast';
import { manufacturersData } from '../data/mockData';

const TABS = ['Revenue', 'Orders', 'QC', 'Manufacturer', 'Custom Builder'];

export default function Reports() {
  const showToast = useToast();
  const [tab, setTab] = useState(0);

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Reports &amp; Analytics</div><div className="page-desc">Business insights across revenue, orders, QC and manufacturers.</div></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => showToast('Report exported as Excel')}><Icon name="download" /> Export Excel</button>
          <button className="btn btn-outline" onClick={() => showToast('Report exported as PDF')}><Icon name="printer" /> Export PDF</button>
        </div>
      </div>
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
                    data: { labels: ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'], datasets: [{ data: [142,151,168,159,180,172,195,201,214,208,231,245].map(v => v * 1000), backgroundColor: '#4f46e5', borderRadius: 5, barThickness: 14 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => '₹' + (Number(v) / 1000) + 'k' }, grid: { color: '#f1f3f7' } }, x: { grid: { display: false } } } },
                  }}
                />
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h3>B2B vs B2C</h3></div>
              <div className="card-pad">
                <ChartCanvas
                  height={90}
                  config={{
                    type: 'doughnut',
                    data: { labels: ['B2B', 'B2C'], datasets: [{ data: [68, 32], backgroundColor: ['#4f46e5', '#a5b4fc'], borderWidth: 0 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '68%' },
                  }}
                />
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Top Customers by Revenue</h3></div>
            <table className="table">
              <thead><tr><th>Customer</th><th>Type</th><th>Orders</th><th>Revenue</th></tr></thead>
              <tbody>
                <tr><td>Acme Corporation</td><td><span className="tag">B2B</span></td><td>18</td><td>₹5,42,000</td></tr>
                <tr><td>Nova Retail Pvt Ltd</td><td><span className="tag">B2B</span></td><td>12</td><td>₹3,10,000</td></tr>
                <tr><td>Priya Sharma</td><td><span className="tag">B2C</span></td><td>4</td><td>₹32,000</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="card kpi"><div className="kpi-label">Total Orders (YTD)</div><div className="kpi-value">1,284</div></div>
            <div className="card kpi"><div className="kpi-label">Avg Order Value</div><div className="kpi-value">₹12,500</div></div>
            <div className="card kpi"><div className="kpi-label">Avg Fulfillment Time</div><div className="kpi-value">11.4 days</div></div>
            <div className="card kpi"><div className="kpi-label">Cancellation Rate</div><div className="kpi-value">2.1%</div></div>
          </div>
          <div className="card">
            <div className="card-head"><h3>Orders by Status</h3></div>
            <div className="card-pad">
              <ChartCanvas
                height={90}
                config={{
                  type: 'bar',
                  data: { labels: ['New','Assigned','In Progress','QC','Invoiced','Paid','Shipped','Delivered','Cancelled'], datasets: [{ data: [9,15,22,15,12,8,10,26,4], backgroundColor: '#2563eb', borderRadius: 5 }] },
                  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f3f7' } } } },
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
                    { label: 'On-time %', data: manufacturersData.map((m) => m.onTime), backgroundColor: '#4f46e5', borderRadius: 5, barThickness: 14 },
                    { label: 'QC pass %', data: manufacturersData.map((m) => m.qc), backgroundColor: '#a5b4fc', borderRadius: 5, barThickness: 14 },
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
