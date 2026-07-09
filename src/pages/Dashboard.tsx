import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ChartCanvas from '../components/ChartCanvas';
import { useToast } from '../components/Toast';
import { activityFeedData, alertsData, formatINR, manufacturersData } from '../data/mockData';

const KPIS = [
  { icon: 'rupee', tone: 'info', delta: '12%', up: true, label: 'Total Revenue (Month)', value: '₹2,45,000' },
  { icon: 'clock', tone: 'warning', delta: '3%', up: false, label: 'Orders Pending QC', value: '15' },
  { icon: 'shieldSm', tone: 'success', delta: '2%', up: true, label: 'QC Pass Rate', value: '92%' },
  { icon: 'bar', tone: 'purple', delta: '6%', up: true, label: 'Average Order Value', value: '₹12,500' },
  { icon: 'file', tone: 'info', delta: '9%', up: true, label: 'Invoices Sent (Month)', value: '48' },
  { icon: 'card', tone: 'danger', delta: '4%', up: false, label: 'Outstanding Payments', value: '₹89,000' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const showToast = useToast();
  const topMfrs = [...manufacturersData].sort((a, b) => b.onTime - a.onTime).slice(0, 5);

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="page-title">Good afternoon, Haneef 👋</div>
          <div className="page-desc">Here's what's happening across Garm operations today, 9 Jul 2026.</div>
        </div>
        <div className="page-actions">
          <select className="field-sm">
            <option>This month</option>
            <option>Last 3 months</option>
            <option>Custom range</option>
          </select>
          <button className="btn btn-outline" onClick={() => showToast('Dashboard exported as PDF')}>
            <Icon name="download" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-6" style={{ marginBottom: 16 }}>
        {KPIS.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: `var(--${k.tone}-bg)`, color: `var(--${k.tone})` }}>
                <Icon name={k.icon} />
              </div>
              <span className={`kpi-delta ${k.up ? 'up' : 'down'}`}>
                <Icon name={k.up ? 'arrowUp' : 'arrowDown'} /> {k.delta}
              </span>
            </div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>Revenue Trend</h3><div className="sub">Last 12 months, gross revenue</div></div>
            <span className="badge tone-success"><span className="dot"></span>+18% YoY</span>
          </div>
          <div className="card-pad">
            <ChartCanvas
              height={90}
              config={{
                type: 'line',
                data: {
                  labels: ['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'],
                  datasets: [{ label: 'Revenue', data: [142,151,168,159,180,172,195,201,214,208,231,245].map(v => v * 1000), borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.08)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2.5 }],
                },
                options: {
                  responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => formatINR(Number(c.raw)) } } },
                  scales: { y: { ticks: { callback: (v) => '₹' + (Number(v) / 1000) + 'k' }, grid: { color: '#f1f3f7' } }, x: { grid: { display: false } } },
                },
              }}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Order Pipeline</h3><div className="sub">Orders currently at each stage</div></div></div>
          <div className="card-pad">
            <ChartCanvas
              height={130}
              config={{
                type: 'bar',
                data: {
                  labels: ['New','Assigned','In Progress','QC','Invoiced','Paid'],
                  datasets: [{ data: [9,15,22,15,12,8], backgroundColor: ['#2563eb','#7c3aed','#d97706','#d97706','#2563eb','#059669'], borderRadius: 6, barThickness: 16 }],
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#f1f3f7' } }, y: { grid: { display: false } } } },
              }}
            />
          </div>
        </div>
      </div>

      <div className="two-col" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>Top Manufacturers</h3><div className="sub">Ranked by on-time delivery this month</div></div>
            <a className="small-muted" style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 700 }} onClick={() => navigate('/manufacturers')}>View all →</a>
          </div>
          <table className="table">
            <thead><tr><th>Manufacturer</th><th>Orders</th><th>On-time</th><th>QC Pass</th><th>Rating</th></tr></thead>
            <tbody>
              {topMfrs.map((m) => (
                <tr key={m.id}>
                  <td className="cust-name">{m.name}</td>
                  <td>{Math.round(m.cap / 40)}</td>
                  <td>{m.onTime}%</td>
                  <td>{m.qc}%</td>
                  <td><span className="stars"><Icon name="check" /></span> {m.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-head"><div><h3>Alerts</h3><div className="sub">Needs your attention</div></div></div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {alertsData.map((a, i) => (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }} key={i}>
                <div className="kpi-icon" style={{ width: 30, height: 30, background: `var(--${a.tone}-bg, var(--slate-bg))`, color: `var(--${a.tone}, var(--slate))`, flex: 'none' }}>
                  <Icon name={a.icon} />
                </div>
                <div style={{ fontSize: '12.6px', lineHeight: 1.5 }}>{a.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><div><h3>Recent Activity</h3><div className="sub">Last actions across the portal</div></div></div>
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column' }}>
          {activityFeedData.map((a, i) => (
            <div style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < activityFeedData.length - 1 ? '1px solid #f1f3f7' : 'none' }} key={i}>
              <div className="kpi-icon" style={{ width: 32, height: 32, background: `var(--${a.tone}-bg)`, color: `var(--${a.tone})`, flex: 'none' }}>
                <Icon name={a.icon} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.text}</div>
                <div className="small-muted">{a.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
