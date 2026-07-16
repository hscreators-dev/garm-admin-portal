import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import ChartCanvas from '../components/ChartCanvas';
import AudienceTabs, { type AudienceFilter } from '../components/AudienceTabs';
import { useToast } from '../components/Toast';
import { useManufacturers } from '../api/useManufacturers';
import { useOrders } from '../api/useOrders';
import { onLiveEvent } from '../api/liveBus';
import { useRole } from '../components/RoleContext';
import { formatINR, type Order } from '../data/mockData';

export default function Dashboard() {
  const navigate = useNavigate();
  const showToast = useToast();
  const { currentUser } = useRole();
  const { manufacturers } = useManufacturers();
  const { orders } = useOrders();
  const [audience, setAudience] = useState<AudienceFilter>('ALL');
  const topMfrs = [...manufacturers].sort((a, b) => b.onTime - a.onTime).slice(0, 5);
  const [liveOrders, setLiveOrders] = useState<Order[]>([]);

  useEffect(() => onLiveEvent<Order>('order:created', (order) => {
    setLiveOrders((prev) => [order, ...prev].slice(0, 5));
    showToast(`New order ${order.no} from ${order.cust} — ${formatINR(order.total)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Real KPIs from the live order book, scoped by customer type.
  const scoped = useMemo(() => orders.filter((o) => audience === 'ALL' || o.type === audience), [orders, audience]);

  // Alerts — derived from the real order book (things needing attention now).
  const realAlerts = useMemo(() => {
    const paidOf = (o: Order) => o.paymentStatus === 'paid' || o.pay === 'COMPLETED';
    const a: { tone: string; icon: string; text: string }[] = [];
    const n = (s: string) => orders.filter((o) => o.status === s).length;
    if (n('NEW')) a.push({ tone: 'info', icon: 'package', text: `${n('NEW')} new order${n('NEW') > 1 ? 's' : ''} awaiting your confirmation.` });
    const payWait = orders.filter((o) => o.status === 'CONFIRMED' && !paidOf(o)).length;
    if (payWait) a.push({ tone: 'warning', icon: 'card', text: `${payWait} order${payWait > 1 ? 's' : ''} waiting for customer payment.` });
    if (n('PAID')) a.push({ tone: 'info', icon: 'factory', text: `${n('PAID')} paid order${n('PAID') > 1 ? 's' : ''} ready to assign to a manufacturer.` });
    if (n('QC_READY')) a.push({ tone: 'warning', icon: 'shieldSm', text: `${n('QC_READY')} order${n('QC_READY') > 1 ? 's' : ''} awaiting quality control.` });
    const failed = orders.filter((o) => o.qc === 'FAILED' || o.qc === 'REWORK').length;
    if (failed) a.push({ tone: 'danger', icon: 'xCircle', text: `${failed} order${failed > 1 ? 's' : ''} failed QC / need rework.` });
    if (n('SHIPPED')) a.push({ tone: 'purple', icon: 'package', text: `${n('SHIPPED')} order${n('SHIPPED') > 1 ? 's' : ''} in transit, awaiting delivery confirmation.` });
    if (a.length === 0) a.push({ tone: 'success', icon: 'check', text: 'All clear — nothing needs your attention right now.' });
    return a.slice(0, 6);
  }, [orders]);

  // Recent activity — the latest real orders + their current stage.
  const recentActivity = useMemo(() => {
    const label = (o: Order): { icon: string; tone: string; text: string } => {
      switch (o.status) {
        case 'NEW':         return { icon: 'package', tone: 'info', text: `New order ${o.no} from ${o.cust}` };
        case 'CONFIRMED':   return { icon: 'checkCircle', tone: 'success', text: `Order ${o.no} confirmed` };
        case 'PAID':        return { icon: 'card', tone: 'success', text: `Payment received — ${o.no}` };
        case 'ASSIGNED':    return { icon: 'factory', tone: 'purple', text: `${o.no} assigned to ${o.mfr}` };
        case 'IN_PROGRESS': return { icon: 'factory', tone: 'warning', text: `${o.no} in production` };
        case 'QC_READY':    return { icon: 'shieldSm', tone: 'warning', text: `${o.no} sent to quality control` };
        case 'QC_APPROVED': return { icon: 'shield', tone: 'success', text: `${o.no} passed QC` };
        case 'INVOICED':    return { icon: 'file', tone: 'info', text: `${o.no} invoiced` };
        case 'SHIPPED':     return { icon: 'package', tone: 'purple', text: `${o.no} shipped` };
        case 'DELIVERED':   return { icon: 'checkCircle', tone: 'success', text: `${o.no} delivered` };
        case 'CANCELLED':   return { icon: 'xCircle', tone: 'danger', text: `${o.no} cancelled` };
        default:            return { icon: 'package', tone: 'slate', text: `${o.no} updated` };
      }
    };
    return [...orders].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 8).map((o) => ({ ...label(o), time: o.date }));
  }, [orders]);
  const amount = (o: Order) => o.total || o.quoteAmount || 0;
  const active = scoped.filter((o) => o.status !== 'CANCELLED');
  const kpis = useMemo(() => {
    const collected = active.filter((o) => o.pay === 'COMPLETED').reduce((s, o) => s + amount(o), 0);
    const outstanding = active.filter((o) => o.pay !== 'COMPLETED').reduce((s, o) => s + amount(o), 0);
    const awaitingConfirm = active.filter((o) => o.type === 'B2C' && o.status === 'NEW').length;
    const inProduction = active.filter((o) => ['ASSIGNED', 'IN_PROGRESS'].includes(o.status)).length;
    const delivered = scoped.filter((o) => o.status === 'DELIVERED').length;
    return [
      { icon: 'card', tone: 'success', label: 'Payments Collected', value: formatINR(collected) },
      { icon: 'card', tone: 'danger', label: 'Outstanding', value: formatINR(outstanding) },
      { icon: 'clock', tone: 'warning', label: 'Awaiting Confirmation', value: String(awaitingConfirm) },
      { icon: 'factory', tone: 'purple', label: 'In Production', value: String(inProduction) },
      { icon: 'package', tone: 'info', label: 'Total Orders', value: String(active.length) },
      { icon: 'check', tone: 'success', label: 'Delivered', value: String(delivered) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped]);
  const pipelineLabels = ['New', 'Confirmed', 'Paid', 'Assigned', 'In Progress', 'QC', 'Invoiced', 'Shipped', 'Delivered'];
  const pipelineData = [
    active.filter((o) => o.status === 'NEW').length,
    active.filter((o) => o.status === 'CONFIRMED').length,
    active.filter((o) => o.status === 'PAID').length,
    active.filter((o) => o.status === 'ASSIGNED').length,
    active.filter((o) => o.status === 'IN_PROGRESS').length,
    active.filter((o) => ['QC_READY', 'QC_APPROVED'].includes(o.status)).length,
    active.filter((o) => o.status === 'INVOICED').length,
    active.filter((o) => o.status === 'SHIPPED').length,
    active.filter((o) => o.status === 'DELIVERED').length,
  ];

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="page-title">Good afternoon, {currentUser?.name.split(' ')[0]} 👋</div>
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

      {liveOrders.length > 0 && (
        <div className="live-order-banner">
          <span className="dot-live"></span>
          <div style={{ flex: 1, fontSize: 12.8 }}>
            <b>{liveOrders.length} new order{liveOrders.length > 1 ? 's' : ''}</b> just came in from the Garm App —{' '}
            {liveOrders.map((o) => o.no).join(', ')}
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/orders')}>View Orders</button>
        </div>
      )}

      <AudienceTabs value={audience} onChange={setAudience} showAll
        counts={{ b2c: orders.filter((o) => o.type === 'B2C').length, b2b: orders.filter((o) => o.type === 'B2B').length }} />

      <div className="grid grid-6" style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: `var(--${k.tone}-bg)`, color: `var(--${k.tone})` }}>
                <Icon name={k.icon} />
              </div>
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
                  datasets: [{ label: 'Revenue', data: [142,151,168,159,180,172,195,201,214,208,231,245].map(v => v * 1000), borderColor: '#0D0D0D', backgroundColor: 'rgba(200,169,126,.16)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2.5 }],
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
          <div className="card-head"><div><h3>Order Pipeline</h3><div className="sub">Live — orders currently at each stage{audience !== 'ALL' ? ` (${audience === 'B2C' ? 'Individuals' : 'Organizations'})` : ''}</div></div></div>
          <div className="card-pad">
            <ChartCanvas
              key={`pipeline-${audience}-${pipelineData.join('-')}`}
              height={130}
              config={{
                type: 'bar',
                data: {
                  labels: pipelineLabels,
                  datasets: [{ data: pipelineData, backgroundColor: ['#2563eb','#059669','#059669','#7c3aed','#d97706','#d97706','#2563eb','#7c3aed','#059669'], borderRadius: 6, barThickness: 12 }],
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#f1f3f7' }, ticks: { precision: 0 } }, y: { grid: { display: false } } } },
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
            {realAlerts.map((a, i) => (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }} key={i}>
                <div className="kpi-icon" style={{ width: 36, height: 36, background: `var(--${a.tone}-bg, var(--slate-bg))`, color: `var(--${a.tone}, var(--slate))`, flex: 'none' }}>
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
          {recentActivity.length === 0 && <div className="small-muted" style={{ padding: 12 }}>No orders yet.</div>}
          {recentActivity.map((a, i) => (
            <div style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < recentActivity.length - 1 ? '1px solid #f1f3f7' : 'none' }} key={i}>
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
