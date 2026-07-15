import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon';
import { api, type SupportTicket } from '../api/client';
import { onLiveEvent } from '../api/liveBus';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: 'Open',        color: '#1a4a8a', bg: '#e3f2fd' },
  IN_PROGRESS: { label: 'In progress', color: '#7c5419', bg: 'rgba(200,169,126,0.14)' },
  RESOLVED:    { label: 'Resolved',    color: '#2e7d32', bg: '#e8f5e9' },
  CLOSED:      { label: 'Closed',      color: '#6b7280', bg: '#f3f4f6' },
};
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  LOW:    { label: 'Low',    color: '#6b7280' },
  NORMAL: { label: 'Normal', color: '#374151' },
  HIGH:   { label: 'High',   color: '#b91c1c' },
};
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
const PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const;

function when(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function Support() {
  const showToast = useToast();
  const confirm = useConfirm();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  function load() {
    api.getTickets().then((d) => setTickets(d.tickets)).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    // Live: a new ticket or reply from the app pushes here via SSE.
    const offs = [
      onLiveEvent<SupportTicket>('support:ticket_created', () => load()),
      onLiveEvent<SupportTicket>('support:ticket_updated', () => load()),
    ];
    // Safety net poll (SSE can miss FAB-backend writes).
    const t = setInterval(load, 20000);
    return () => { offs.forEach((o) => o()); clearInterval(t); };
  }, []);

  const visible = useMemo(() => tickets.filter((t) => {
    if (filter && t.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (q && !(t.ref.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || (t.customerName || '').toLowerCase().includes(q))) return false;
    return true;
  }), [tickets, filter, search]);

  // Two OPEN/IN_PROGRESS tickets from the same customer that share a category or
  // order are almost certainly the same issue raised twice. Flag them so the
  // admin can merge/close instead of working both sides separately.
  function siblingsOf(t: SupportTicket): SupportTicket[] {
    const who = t.userId || t.customerEmail || t.customerPhone || t.customerName;
    if (!who) return [];
    return tickets.filter((o) =>
      o._id !== t._id &&
      (o.status === 'OPEN' || o.status === 'IN_PROGRESS') &&
      (o.userId || o.customerEmail || o.customerPhone || o.customerName) === who &&
      ((t.orderRef && o.orderRef && t.orderRef === o.orderRef) ||
       (t.category && o.category && t.category === o.category) ||
       (t.type === 'return' && o.type === 'return')));
  }
  function isDuplicate(t: SupportTicket): boolean {
    if (t.status !== 'OPEN' && t.status !== 'IN_PROGRESS') return false;
    return siblingsOf(t).length > 0;
  }

  const selected = tickets.find((t) => t._id === selId) || null;
  const selectedSiblings = selected ? siblingsOf(selected) : [];
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [selected?.messages.length, selId]);

  const openCount = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgCount = tickets.filter((t) => t.status === 'IN_PROGRESS').length;
  // Counts per section for the status tabs.
  const counts = useMemo(() => ({
    '':            tickets.length,
    OPEN:          tickets.filter((t) => t.status === 'OPEN').length,
    IN_PROGRESS:   tickets.filter((t) => t.status === 'IN_PROGRESS').length,
    RESOLVED:      tickets.filter((t) => t.status === 'RESOLVED').length,
    CLOSED:        tickets.filter((t) => t.status === 'CLOSED').length,
  } as Record<string, number>), [tickets]);
  const TABS: { key: string; label: string }[] = [
    { key: '', label: 'All' },
    { key: 'OPEN', label: 'New' },
    { key: 'IN_PROGRESS', label: 'In progress' },
    { key: 'RESOLVED', label: 'Resolved' },
    { key: 'CLOSED', label: 'Closed' },
  ];

  async function sendReply() {
    if (!selected || !reply.trim()) return;
    setBusy(true);
    try {
      const { ticket } = await api.replyTicket(selected._id, reply.trim());
      setTickets((prev) => prev.map((t) => (t._id === ticket._id ? ticket : t)));
      setReply('');
    } catch (err) {
      showToast(`Couldn't send reply: ${(err as Error).message}`);
    } finally { setBusy(false); }
  }
  async function setField(patch: Partial<Pick<SupportTicket, 'status' | 'priority'>>) {
    if (!selected) return;
    try {
      const { ticket } = await api.updateTicket(selected._id, patch);
      setTickets((prev) => prev.map((t) => (t._id === ticket._id ? ticket : t)));
      showToast(`${ticket.ref} updated`);
    } catch (err) {
      showToast(`Couldn't update: ${(err as Error).message}`);
    }
  }
  async function closeTicket() {
    if (!selected) return;
    const ok = await confirm({
      title: 'Close this ticket?',
      message: `${selected.ref} will be marked resolved and the conversation closed. The customer can still reopen it by replying from the app.`,
      confirmLabel: 'Resolve & close',
    });
    if (!ok) return;
    await setField({ status: 'CLOSED' });
    setFilter('CLOSED');      // jump the view to the Closed section so you see it land there
    showToast(`${selected.ref} moved to Closed`);
  }
  async function reopenTicket() {
    if (!selected) return;
    await setField({ status: 'IN_PROGRESS' });
    setFilter('IN_PROGRESS'); // moves it back into the active queue
    showToast(`${selected.ref} reopened — back in In progress`);
  }
  async function decideReturn(decision: 'APPROVED' | 'DECLINED') {
    if (!selected) return;
    try {
      const { ticket } = await api.returnDecision(selected._id, decision);
      setTickets((prev) => prev.map((t) => (t._id === ticket._id ? ticket : t)));
      showToast(`Return ${decision === 'APPROVED' ? 'approved' : 'declined'} — customer notified in their ticket.`);
    } catch (err) {
      showToast(`Couldn't record decision: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Support</div>
          <div className="page-desc">Tickets raised by customers in the Garm App — reply, prioritise and resolve. {openCount} open · {inProgCount} in progress.</div>
        </div>
        <div className="page-actions"><span className="sync-badge"><span className="sync-dot"></span>Live sync connected</span></div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* ── Ticket list ── */}
        <div className="card" style={{ flex: '0 0 380px', maxWidth: 380, overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
            <input placeholder="Search ref, subject, customer…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%' }} />
          </div>
          {/* Status sections — New / In progress / Resolved / Closed with live counts */}
          <div style={{ display: 'flex', gap: 4, padding: '8px 10px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
            {TABS.map((tab) => {
              const active = filter === tab.key;
              const n = counts[tab.key] ?? 0;
              return (
                <button key={tab.key} onClick={() => setFilter(tab.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: active ? 'var(--ink, #111827)' : 'var(--muted, #f3f4f6)',
                    color: active ? '#fff' : '#374151' }}>
                  {tab.label}
                  <span style={{ fontSize: 10.5, fontWeight: 700, padding: '0 5px', borderRadius: 999, minWidth: 16, textAlign: 'center',
                    background: active ? 'rgba(255,255,255,0.22)' : (tab.key === 'OPEN' && n > 0 ? '#dc2626' : 'rgba(0,0,0,0.08)'),
                    color: active ? '#fff' : (tab.key === 'OPEN' && n > 0 ? '#fff' : '#6b7280') }}>{n}</span>
                </button>
              );
            })}
          </div>
          <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {loading && <div className="small-muted" style={{ padding: 16 }}>Loading tickets…</div>}
            {!loading && visible.length === 0 && <div className="small-muted" style={{ padding: 16 }}>No tickets{filter ? ' in this status' : ' yet'}.</div>}
            {visible.map((t) => {
              const s = STATUS_META[t.status] ?? STATUS_META.OPEN;
              const last = t.messages[t.messages.length - 1];
              const dupe = isDuplicate(t);
              return (
                <button key={t._id} onClick={() => setSelId(t._id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', borderBottom: '1px solid var(--border)', background: selId === t._id ? 'var(--muted, #f6f6f5)' : 'transparent', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span className="small-muted" style={{ fontSize: 11 }}>{t.ref}</span>
                    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
                      {dupe && <span title="Same customer has another open ticket in this category / order" style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>Possible duplicate</span>}
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>
                    </span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.type === 'return' ? '↩ ' : ''}{t.subject}</div>
                  <div className="small-muted" style={{ fontSize: 12, marginTop: 1 }}>{t.customerName}{t.type === 'return' ? ' · Return' : ''}{t.priority === 'HIGH' && t.type !== 'return' ? ' · ⚠ High' : ''}</div>
                  {last && <div className="small-muted" style={{ fontSize: 11.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.from === 'admin' ? 'You: ' : ''}{last.body}</div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Ticket detail ── */}
        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          {!selected ? (
            <div className="small-muted" style={{ padding: 40, textAlign: 'center' }}>Select a ticket to view the conversation.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)' }}>
              {selectedSiblings.length > 0 && (
                <div style={{ padding: '10px 16px', background: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9a3412' }}>Possible duplicate — same customer, {selected.orderRef ? `order ${selected.orderRef}` : `“${selected.category}”`}</div>
                  <div className="small-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                    Also open:{' '}
                    {selectedSiblings.map((sib, i) => (
                      <span key={sib._id}>
                        {i > 0 ? ', ' : ''}
                        <a className="link" onClick={() => setSelId(sib._id)}>{sib.ref}</a>
                      </span>
                    ))}
                    . Reply on one and mark the other Resolved to avoid answering twice.
                  </div>
                </div>
              )}
              <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{selected.subject}</div>
                    <div className="small-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {selected.ref} · {selected.category}{selected.orderRef ? ` · Order ${selected.orderRef}` : ''}
                    </div>
                    <div className="small-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {selected.customerName}{selected.customerEmail ? ` · ${selected.customerEmail}` : ''}{selected.customerPhone ? ` · ${selected.customerPhone}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <select value={selected.priority} onChange={(e) => setField({ priority: e.target.value as SupportTicket['priority'] })} title="Priority">
                      {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label} priority</option>)}
                    </select>
                    <select value={selected.status} onChange={(e) => setField({ status: e.target.value as SupportTicket['status'] })} title="Status">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {selected.type === 'return' && (
                <div style={{ padding: 14, borderBottom: '1px solid var(--border)', background: 'var(--muted, #f6f6f5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>Return / damage request</span>
                    {(() => {
                      const rs = selected.returnStatus;
                      const meta: Record<string, { label: string; color: string; bg: string }> = {
                        REQUESTED: { label: 'Awaiting decision', color: '#7c5419', bg: 'rgba(200,169,126,0.14)' },
                        APPROVED:  { label: 'Approved', color: '#2e7d32', bg: '#e8f5e9' },
                        DECLINED:  { label: 'Declined', color: '#b91c1c', bg: '#fee2e2' },
                        NONE:      { label: '', color: '', bg: '' },
                      };
                      const m = meta[rs] || meta.REQUESTED;
                      return m.label ? <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: m.bg, color: m.color }}>{m.label}</span> : null;
                    })()}
                  </div>
                  {selected.images && selected.images.length > 0 ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {selected.images.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noreferrer" title="Open full size">
                          <img src={src} alt={`damage ${i + 1}`} style={{ width: 76, height: 76, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                        </a>
                      ))}
                    </div>
                  ) : <div className="small-muted" style={{ fontSize: 12, marginBottom: 10 }}>No photos attached.</div>}
                  {selected.returnStatus === 'REQUESTED' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={() => decideReturn('APPROVED')}><Icon name="checkCircle" /> Approve return</button>
                      <button className="btn btn-outline" onClick={() => decideReturn('DECLINED')}><Icon name="xCircle" /> Decline</button>
                    </div>
                  )}
                </div>
              )}

              <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selected.messages.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.from === 'admin' ? 'flex-end' : 'flex-start', maxWidth: '78%', background: m.from === 'admin' ? 'rgba(200,169,126,0.14)' : 'var(--muted, #f6f6f5)', border: '1px solid var(--border)', borderRadius: 12, padding: '9px 12px' }}>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{m.body}</div>
                    <div className="small-muted" style={{ fontSize: 10.5, marginTop: 4 }}>{m.from === 'admin' ? (m.authorName || 'Garm Support') : selected.customerName} · {when(m.at)}</div>
                  </div>
                ))}
              </div>

              {selected.status !== 'CLOSED' ? (
                <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea placeholder="Reply to the customer…" value={reply} onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                      style={{ flex: 1, resize: 'none', height: 44 }} />
                    <button className="btn btn-primary" disabled={!reply.trim() || busy} onClick={sendReply}><Icon name="mail" /> Send</button>
                  </div>
                  {/* Clear close action so tickets don't stay "open" forever. */}
                  <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-end' }} onClick={closeTicket}>
                    <Icon name="checkCircle" /> Resolve &amp; close ticket
                  </button>
                </div>
              ) : (
                <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#f3f4f6' }}>
                  <span className="small-muted" style={{ fontSize: 12 }}><Icon name="checkCircle" /> This ticket is closed.</span>
                  <button className="btn btn-outline btn-sm" onClick={reopenTicket}><Icon name="repeat" /> Reopen</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
