import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { api, type SupportTicket } from '../api/client';
import { onLiveEvent } from '../api/liveBus';
import { useOrders } from '../api/useOrders';

// Real notification feed for the admin topbar: things that need someone's
// attention right now — new customer orders awaiting confirmation, orders
// waiting on QC, and open/in-progress support tickets. Clicking an item jumps
// to the right page. The badge shows the live count.
export default function NotificationBell() {
  const navigate = useNavigate();
  const { orders } = useOrders();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => api.getTickets().then((d) => setTickets(d.tickets)).catch(() => {});
    load();
    const offs = [
      onLiveEvent('support:ticket_created', load),
      onLiveEvent('support:ticket_updated', load),
    ];
    const t = setInterval(load, 20000);
    return () => { offs.forEach((o) => o()); clearInterval(t); };
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const items = useMemo(() => {
    const list: { key: string; title: string; sub: string; to: string; tone: string }[] = [];
    for (const o of orders) {
      if (o.status === 'NEW' || o.status === 'CONFIRMED') {
        list.push({ key: `o-new-${o.id}`, title: `New order ${o.no}`, sub: `${o.cust} · needs confirmation`, to: '/orders', tone: '#1a4a8a' });
      } else if (o.status === 'QC_READY') {
        list.push({ key: `o-qc-${o.id}`, title: `QC ready ${o.no}`, sub: `${o.cust} · awaiting inspection`, to: '/qc', tone: '#e65100' });
      }
    }
    for (const t of tickets) {
      if (t.status === 'OPEN') list.push({ key: `t-${t._id}`, title: `New ticket ${t.ref}`, sub: `${t.customerName} · ${t.subject}`, to: '/support', tone: '#7c5419' });
      else if (t.status === 'IN_PROGRESS') list.push({ key: `t-${t._id}`, title: `Ticket ${t.ref}`, sub: `${t.customerName} · in progress`, to: '/support', tone: '#7c5419' });
    }
    return list;
  }, [orders, tickets]);

  const count = items.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((v) => !v)} title="Notifications">
        {count > 0 && <span className="dot-badge" style={{ background: 'var(--danger, #dc2626)' }}></span>}
        <Icon name="bell" />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxHeight: 420, overflowY: 'auto', background: 'var(--card, #fff)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 34px rgba(0,0,0,0.16)', zIndex: 100 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
            <span className="small-muted" style={{ fontSize: 12 }}>{count} to action</span>
          </div>
          {count === 0 && <div className="small-muted" style={{ padding: 24, textAlign: 'center', fontSize: 13 }}>All caught up — nothing needs attention.</div>}
          {items.map((it) => (
            <button key={it.key} onClick={() => { setOpen(false); navigate(it.to); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: it.tone, flex: 'none' }}></span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{it.title}</span>
              </div>
              <div className="small-muted" style={{ fontSize: 12, marginTop: 2, marginLeft: 14 }}>{it.sub}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
