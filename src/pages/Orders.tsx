import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Confirm';
import { useOrders } from '../api/useOrders';
import { useUsers } from '../api/useUsers';
import { useManufacturers } from '../api/useManufacturers';
import { api } from '../api/client';
import { formatINR, type Order } from '../data/mockData';

// ─── Status flows ──────────────────────────────────────────────────────────────
// Individuals (B2C): submit → admin ACCEPTS & CONFIRMS → customer sees the
// confirmation + final price in the Garm App and PAYS → only then production.
// No in-house QC and no invoicing step for B2C.
// Organizations (B2B): quote flow with QC + invoicing as before.
const STEPS_B2C = [
  { s: 'NEW', l: 'Order Submitted' },
  { s: 'CONFIRMED', l: 'Confirmed by Admin' },
  { s: 'PAID', l: 'Payment Received' },
  { s: 'ASSIGNED', l: 'Assigned to Manufacturer' },
  { s: 'IN_PROGRESS', l: 'In Production' },
  { s: 'QC_READY', l: 'Awaiting QC' },
  { s: 'QC_APPROVED', l: 'QC Approved' },
  { s: 'SHIPPED', l: 'Shipped' },
  { s: 'DELIVERED', l: 'Delivered' },
];
const STEPS_B2B = [
  { s: 'NEW', l: 'Order Placed' },
  { s: 'ASSIGNED', l: 'Assigned to Manufacturer' },
  { s: 'IN_PROGRESS', l: 'In Production' },
  { s: 'QC_READY', l: 'Awaiting QC' },
  { s: 'QC_APPROVED', l: 'QC Approved' },
  { s: 'INVOICED', l: 'Invoiced' },
  { s: 'PAID', l: 'Payment Received' },
  { s: 'SHIPPED', l: 'Shipped' },
  { s: 'DELIVERED', l: 'Delivered' },
];

function stepsFor(type: 'B2B' | 'B2C') {
  return type === 'B2B' ? STEPS_B2B : STEPS_B2C;
}

function totalPieces(o: Order): number {
  if (o.qty) return o.qty;
  if (o.sizes?.length) return o.sizes.reduce((s, x) => s + (x.qty || 0), 0);
  if (o.accessoryItems?.length) return o.accessoryItems.reduce((s, x) => s + (x.qty || 0), 0);
  return o.lines?.reduce((s, l) => s + (l.qty || 0), 0) || 0;
}

function orderForLabel(o: Order): string {
  if (o.persona === 'organisation') return o.orgName ? `Organisation — ${o.orgName}` : 'Organisation';
  return 'Individual';
}

function csvEscape(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadDataUrl(dataUrl: string, name: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  a.click();
}

const DOC_KIND_LABELS: Record<string, string> = {
  INVOICE: 'Invoice', QUOTATION: 'Quotation', BILLING: 'Billing', DESIGN: 'Design / logo', OTHER: 'Document',
};

export default function Orders() {
  const { orders, loading, refresh } = useOrders();
  const { manufacturers } = useManufacturers();
  const { users } = useUsers();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = orders.find((o) => o.id === selectedId) || null;

  if (loading) return (
    // Proper loading state — skeleton order rows instead of a near-blank page.
    <div style={{ padding: 24 }}>
      <style>{`@keyframes ordersShimmer{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
      <div className="small-muted" style={{ marginBottom: 14 }}>Loading orders…</div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{
          background: 'var(--card, #fff)', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 16,
          animation: `ordersShimmer 1.2s ease-in-out ${i * 0.12}s infinite`,
        }}>
          <div style={{ width: 70, height: 12, borderRadius: 6, background: 'var(--muted, #f0efed)' }}/>
          <div style={{ width: 180, height: 12, borderRadius: 6, background: 'var(--muted, #f0efed)' }}/>
          <div style={{ width: 90, height: 12, borderRadius: 6, background: 'var(--muted, #f0efed)' }}/>
          <div style={{ flex: 1 }}/>
          <div style={{ width: 60, height: 20, borderRadius: 10, background: 'var(--muted, #f0efed)' }}/>
        </div>
      ))}
    </div>
  );

  return selected ? (
    <OrderDetail
      order={selected}
      manufacturers={manufacturers}
      employees={users.filter((u) => u.status !== 'Disabled')}
      onBack={() => setSelectedId(null)}
      onChanged={refresh}
    />
  ) : (
    <OrdersList orders={orders} manufacturers={manufacturers} onOpen={(o) => setSelectedId(o.id)} onCreated={refresh} />
  );
}

// ─── List ──────────────────────────────────────────────────────────────────────
function OrdersList({ orders, manufacturers, onOpen, onCreated }: {
  orders: Order[]; manufacturers: { id: number; name: string }[]; onOpen: (o: Order) => void; onCreated: () => void;
}) {
  const showToast = useToast();
  const [ordersType, setOrdersType] = useState<'B2C' | 'B2B'>('B2C');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [mfr, setMfr] = useState('');
  const [qc, setQc] = useState('');
  const [pay, setPay] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [modal, setModal] = useState(false);

  const [form, setForm] = useState({ cust: '', address: '', product: 'T-Shirts', qty: 100, size: 'L', color: 'Black', email: '', notes: '', unit: 250 });

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      if (o.type !== ordersType) return false;
      if (q && !(o.no.toLowerCase().includes(q) || o.cust.toLowerCase().includes(q) || (o.email || '').toLowerCase().includes(q))) return false;
      if (status && o.status !== status) return false;
      if (mfr && o.mfr !== mfr) return false;
      if (ordersType === 'B2B' && qc && o.qc !== qc) return false;
      if (pay && o.pay !== pay) return false;
      return true;
    });
  }, [orders, ordersType, search, status, mfr, qc, pay]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const awaiting = ordersType === 'B2C' ? rows.filter((o) => o.status === 'NEW').length : 0;

  function resetFilters() {
    setSearch(''); setStatus(''); setMfr(''); setQc(''); setPay(''); setPage(1);
  }

  function exportCsv() {
    const header = ['Order #', 'Customer', 'Type', 'Email', 'Pieces', 'Total (INR)', 'Status', 'QC', 'Payment', 'Payment method', 'Assigned to', 'Manufacturer', 'Date'];
    const body = rows.map((o) => [
      o.no, o.cust, o.type, o.email, totalPieces(o), o.total, o.status, o.qc, o.pay,
      o.paymentMode || '', o.assignedEmployee || '', o.mfr, o.date,
    ].map(csvEscape).join(','));
    const blob = new Blob([[header.map(csvEscape).join(','), ...body].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `garm-orders-${ordersType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Exported ${rows.length} order${rows.length === 1 ? '' : 's'} to CSV`);
  }

  async function submitManualOrder() {
    try {
      const order = await api.createOrder({
        cust: form.cust || 'Walk-in Customer',
        type: ordersType,
        email: form.email || '',
        address: form.address,
        notes: form.notes,
        lines: [{ p: form.product, size: form.size, color: form.color, qty: Number(form.qty) || 1, unit: Number(form.unit) || 0 }],
      });
      showToast(`Manual order logged — ${order.no}.`);
      onCreated();
    } catch (err) {
      showToast(`Could not log order: ${(err as Error).message}`);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="page-title">Orders</div>
          <div className="page-desc">Orders placed in the Garm App land here automatically. Individual orders must be accepted &amp; confirmed before the customer can pay.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={exportCsv}><Icon name="download" /> Export CSV</button>
          <button className="btn btn-outline btn-sm" onClick={() => setModal(true)}><Icon name="plus" /> Log Manual Order</button>
        </div>
      </div>

      <div className="seg-tabs">
        <button className={`seg-tab ${ordersType === 'B2C' ? 'active' : ''}`} onClick={() => { setOrdersType('B2C'); setPage(1); setStatus(''); }}>
          <Icon name="user" /> Individuals <span className="seg-count">{orders.filter((o) => o.type === 'B2C').length}</span>
        </button>
        <button className={`seg-tab ${ordersType === 'B2B' ? 'active' : ''}`} onClick={() => { setOrdersType('B2B'); setPage(1); setStatus(''); }}>
          <Icon name="factory" /> Organizations <span className="seg-count">{orders.filter((o) => o.type === 'B2B').length}</span>
        </button>
      </div>
      {ordersType === 'B2C' && awaiting > 0 && (
        <div className="small-muted" style={{ margin: '-10px 0 16px', color: 'var(--warning, #b45309)' }}>
          ⚠ {awaiting} order{awaiting === 1 ? '' : 's'} awaiting your confirmation — customers can't pay until you accept.
        </div>
      )}

      <div className="filter-bar">
        <div className="search-inline">
          <Icon name="search" />
          <input placeholder="Search order #, customer, email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="field-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {[...stepsFor(ordersType).map((s) => s.s), 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="field-sm" value={mfr} onChange={(e) => { setMfr(e.target.value); setPage(1); }}>
          <option value="">All manufacturers</option>
          {manufacturers.map((m) => <option key={m.id}>{m.name}</option>)}
        </select>
        {ordersType === 'B2B' && (
          <select className="field-sm" value={qc} onChange={(e) => { setQc(e.target.value); setPage(1); }}>
            <option value="">Any QC status</option><option>PENDING</option><option>PASSED</option><option>FAILED</option><option>REWORK</option>
          </select>
        )}
        <select className="field-sm" value={pay} onChange={(e) => { setPay(e.target.value); setPage(1); }}>
          <option value="">Any payment</option><option>PENDING</option><option>PARTIAL</option><option>COMPLETED</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={resetFilters}><Icon name="filter" /> Reset</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Order #</th><th>Customer</th><th>Order details</th><th>Finishing</th><th>Pieces</th><th>Total</th><th>Status</th>{ordersType === 'B2B' && <th>QC</th>}<th>Payment</th><th>Assigned to</th><th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={ordersType === 'B2B' ? 12 : 11} style={{ textAlign: 'center', color: 'var(--muted)', padding: 26 }}>
                No {ordersType === 'B2C' ? 'Individual' : 'Organization'} orders match these filters.
              </td></tr>
            )}
            {pageRows.map((o) => {
              const detailTop = o.isAccessoryOrder
                ? `${o.accessoryItems?.length || o.lines?.length || 0} accessory item${(o.accessoryItems?.length || 0) === 1 ? '' : 's'}`
                : [o.garmentType || o.serviceLabel || o.lines?.[0]?.p, o.fabric].filter(Boolean).join(' · ') || '—';
              const colorSummary = o.colors?.length ? o.colors.map((c) => c.label).slice(0, 2).join(', ') + (o.colors.length > 2 ? '…' : '') : (o.lines?.[0]?.color || '');
              const delivery = [o.deliveryCity || o.address?.split(',').slice(-2, -1)[0]?.trim(), o.deliveryPin].filter(Boolean).join(' · ');
              return (
                <tr className="clickable" key={o.id} onClick={() => onOpen(o)}>
                  <td className="tnum">{o.no}</td>
                  <td>
                    <div className="cust-name">{o.cust}</div>
                    <div className="cust-sub">{orderForLabel(o)}{o.contactPhone ? ` · ${o.contactPhone}` : ''}</div>
                    {delivery && <div className="cust-sub">{delivery}</div>}
                  </td>
                  <td>
                    <div>{detailTop}</div>
                    {colorSummary && <div className="cust-sub">{colorSummary}{o.gsm ? ` · ${o.gsm}` : ''}</div>}
                  </td>
                  <td>
                    {o.stitching || o.packaging
                      ? <><div>{o.stitching || '—'}</div><div className="cust-sub">{o.packaging || ''}</div></>
                      : <span className="small-muted">—</span>}
                  </td>
                  <td>{totalPieces(o)} pcs</td>
                  <td className="tnum">{formatINR(o.total || o.quoteAmount || 0)}</td>
                  <td><Badge status={o.status} /></td>
                  {ordersType === 'B2B' && <td><Badge status={o.qc} /></td>}
                  <td>
                    <Badge status={o.pay} />
                    {o.paymentMode && <div className="cust-sub">{o.paymentMode}</div>}
                  </td>
                  <td>{o.assignedEmployee || <span className="small-muted">—</span>}</td>
                  <td className="tnum">{o.date}</td>
                  <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn btn-sm" title="View full order" style={{ width: 36, height: 36 }} onClick={() => onOpen(o)}><Icon name="eye" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pager">
          <span>Showing <b>{pageRows.length}</b> of <b>{rows.length}</b> {ordersType === 'B2C' ? 'Individual' : 'Organization'} orders</span>
          <div className="pager-btns">
            <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}><Icon name="chevLeft" /></button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).slice(0, 7).map((n) => (
              <button key={n} className={n === safePage ? 'active' : ''} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}><Icon name="chevRight" /></button>
          </div>
        </div>
      </div>

      <Modal open={modal} title={`Log Manual ${ordersType === 'B2C' ? 'Individual' : 'Organization'} Order`} confirmLabel="Log Order" onClose={() => setModal(false)} onConfirm={submitManualOrder}>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          For phone/offline orders only — orders placed in the Garm App appear automatically and don't need this.
        </div>
        <div className="form-grid">
          <div className="form-field full"><label>Customer name</label><input value={form.cust} onChange={(e) => setForm({ ...form, cust: e.target.value })} placeholder="e.g. Acme Corporation" /></div>
          <div className="form-field full"><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="customer@email.com" /></div>
          <div className="form-field full"><label>Delivery address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street, city, state, postal code" /></div>
          <div className="form-field"><label>Product</label><input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="e.g. T-Shirts" /></div>
          <div className="form-field"><label>Quantity</label><input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></div>
          <div className="form-field"><label>Size</label>
            <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option><option>One size</option></select>
          </div>
          <div className="form-field"><label>Color</label><input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Black" /></div>
          <div className="form-field"><label>Unit price (₹)</label><input type="number" value={form.unit} onChange={(e) => setForm({ ...form, unit: Number(e.target.value) })} /></div>
          <div className="form-field full"><label>Notes</label><textarea className="ta" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Customization, special instructions…"></textarea></div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Detail ────────────────────────────────────────────────────────────────────
function OrderDetail({ order, manufacturers, employees, onBack, onChanged }: {
  order: Order;
  manufacturers: { id: number; name: string; city: string; lead: number }[];
  employees: { id: number; name: string; role: string }[];
  onBack: () => void; onChanged: () => void;
}) {
  const showToast = useToast();
  const confirm = useConfirm();
  const [confirmModal, setConfirmModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [note, setNote] = useState(order.notes || '');
  const [assignMfr, setAssignMfr] = useState(order.mfr !== '—' ? order.mfr : (manufacturers[0]?.name || ''));
  const [assignEta, setAssignEta] = useState(order.etaDate || '');
  const [assignEmp, setAssignEmp] = useState(order.assignedEmployee || employees[0]?.name || '');
  const [confirmForm, setConfirmForm] = useState({
    price: order.total || order.quoteAmount || 0,
    employee: order.assignedEmployee || employees[0]?.name || '',
    eta: order.etaDate || '',
  });
  const [payForm, setPayForm] = useState({ amount: order.total || order.quoteAmount || 0, method: order.paymentMode || 'Bank Transfer', date: '', reference: '' });
  const [docKind, setDocKind] = useState('INVOICE');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  // Inline preview (lightbox) for customer design/logo uploads — the team must
  // SEE what the customer sent without downloading every file blindly.
  const [previewDoc, setPreviewDoc] = useState<{ name: string; dataUrl: string } | null>(null);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [shipModal, setShipModal] = useState(false);
  const [shipForm, setShipForm] = useState({ courier: '', tracking: '' });
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [refundModal, setRefundModal] = useState(false);
  const [refundForm, setRefundForm] = useState({ amount: 0, reason: '', reference: '' });
  const [mfrPayModal, setMfrPayModal] = useState(false);
  const [mfrPayForm, setMfrPayForm] = useState({ bill: 0, amount: 0, method: 'Bank Transfer', reference: '' });

  const isB2C = order.type === 'B2C';
  const pieces = totalPieces(order);
  const displayTotal = order.total || order.quoteAmount || 0;
  const serviceFee = order.serviceFee || 0;
  const subtotal = Math.round((displayTotal - serviceFee) / 1.18);
  const tax = displayTotal - serviceFee - subtotal;
  const steps = stepsFor(order.type);
  const curIdx = order.status === 'CANCELLED' ? -1 : steps.findIndex((s) => s.s === order.status);
  const paid = order.paymentStatus === 'paid' || order.pay === 'COMPLETED';
  // Both Individual (B2C) AND Organisation (B2B) orders need the coordinator to
  // set the final price before anything is payable. Previously this was gated to
  // isB2C, so an organisation order had NO "Accept & Confirm" button anywhere —
  // it was permanently stuck at ₹0 with no way to enter the quote, which is why
  // org totals never matched the customer app. Confirming writes total +
  // quoteAmount and unlocks the customer's payment (advance for org).
  const awaitingConfirmation = order.status === 'NEW';
  const awaitingPayment = order.status === 'CONFIRMED' && !paid;
  // Cancel / refund availability — tied to the production lifecycle:
  //  • Cancel: allowed only BEFORE production starts (NEW → CONFIRMED → PAID →
  //    ASSIGNED). Once IN_PROGRESS (production) or later, the order can't be
  //    cancelled by anyone.
  //  • Refund: only makes sense when money was collected AND the order is
  //    cancelled or delivered (e.g. damage). Never shown during confirmation or
  //    active production.
  const refundedTotal = order.refundAmount || 0;
  const everPaid = paid || order.pay === 'PARTIAL' || ['partial', 'paid', 'partial_refund'].includes(order.paymentStatus || '');
  const fullyRefunded = order.paymentStatus === 'refunded' || (displayTotal > 0 && refundedTotal >= displayTotal);
  const productionOrLater = ['IN_PROGRESS', 'QC_READY', 'QC_APPROVED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status);
  const canCancel = !productionOrLater;
  const canRefund = everPaid && !fullyRefunded && ['CANCELLED', 'DELIVERED'].includes(order.status);
  // Manufacturer payment — relevant once the order is with a manufacturer.
  const mfrAssigned = !!order.mfr && order.mfr !== '—';
  const mfrBill = order.mfrBillAmount || 0;
  const mfrPaid = order.mfrPaidAmount || 0;
  const mfrFullyPaid = order.mfrPayStatus === 'PAID' || (mfrBill > 0 && mfrPaid >= mfrBill);

  async function patchOrder(patch: Record<string, unknown>, okMsg: string) {
    try {
      await api.updateOrderStatus(order.id, patch);
      showToast(okMsg);
      onChanged();
    } catch (err) {
      showToast(`Could not update order: ${(err as Error).message}`);
    }
  }

  function confirmOrder() {
    patchOrder(
      { status: 'CONFIRMED', total: Number(confirmForm.price) || 0, quoteAmount: Number(confirmForm.price) || 0, assignedEmployee: confirmForm.employee, etaDate: confirmForm.eta || undefined },
      `Order confirmed — the customer can now see the confirmation and pay in the Garm App`,
    );
  }

  function confirmAssign() {
    patchOrder({ status: 'ASSIGNED', mfr: assignMfr, etaDate: assignEta || undefined }, `Order assigned to ${assignMfr}`);
    // Internal WhatsApp hand-off to the manufacturer — opens a prefilled
    // message; the admin picks the manufacturer's contact and sends.
    const msg = `Garm order ${order.no} assigned to you: ${pieces} pcs — ${order.garmentType || order.serviceLabel || 'order'}`
      + `${order.fabric ? ` · ${order.fabric}` : ''}${order.gsm ? ` · ${order.gsm}` : ''}. ETA: ${assignEta || 'TBD'}. Order sheet follows by email.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function confirmEmployee() {
    patchOrder({ assignedEmployee: assignEmp }, `${assignEmp} is now handling ${order.no} — the customer sees their name (contact details stay the same)`);
  }

  function confirmPayment() {
    // A second payment on an already-partial order is the BALANCE — the order
    // is then fully settled even though this amount alone is less than the
    // total. (Previously the balance recording stayed PARTIAL forever, which
    // kept shipping locked.)
    const alreadyPartial = order.pay === 'PARTIAL' || order.paymentStatus === 'partial';
    const pay = alreadyPartial || payForm.amount >= displayTotal ? 'COMPLETED' : 'PARTIAL';
    patchOrder({ pay }, `Payment of ${formatINR(payForm.amount)} recorded — order marked ${pay === 'COMPLETED' ? 'fully paid' : 'partially paid (advance)'}`);
  }

  function cancelOrder() {
    patchOrder(
      { status: 'CANCELLED', cancelReason: cancelReason.trim() || undefined },
      `Order ${order.no} cancelled — the customer sees it as Cancelled in the Garm App.${everPaid ? ' Issue a refund from the Payment card if money was collected.' : ''}`,
    );
    setCancelModal(false);
    setCancelReason('');
  }

  function confirmRefund() {
    const amount = Math.round(Number(refundForm.amount) || 0);
    if (amount <= 0) { showToast('Enter a refund amount greater than zero.'); return; }
    patchOrder(
      { refund: { amount, reason: refundForm.reason.trim() || undefined, reference: refundForm.reference.trim() || undefined } },
      `Refund of ${formatINR(amount)} recorded for ${order.no} — the customer sees it in the Garm App.`,
    );
    setRefundModal(false);
  }

  function confirmMfrPayment() {
    const bill = Math.round(Number(mfrPayForm.bill) || 0);
    const amount = Math.round(Number(mfrPayForm.amount) || 0);
    if (bill <= 0 && amount <= 0) { showToast('Enter the bill amount and/or a payment.'); return; }
    patchOrder(
      { mfrPayment: { bill, amount, method: mfrPayForm.method, reference: mfrPayForm.reference.trim() || undefined } },
      amount > 0 ? `Recorded ${formatINR(amount)} paid to ${order.mfr}.` : `Manufacturer bill set to ${formatINR(bill)}.`,
    );
    setMfrPayModal(false);
  }

  function confirmShip() {
    const courier = shipForm.courier.trim();
    const tracking = shipForm.tracking.trim();
    patchOrder(
      { status: 'SHIPPED', trackingCourier: courier || undefined, trackingNumber: tracking || undefined },
      tracking ? `Marked Shipped · ${courier || 'courier'} ${tracking} — the customer can track it in the app.` : 'Marked as Shipped — the customer got the Shipped update in Track.',
    );
    setShipModal(false);
    setShipForm({ courier: '', tracking: '' });
  }

  async function generateInvoice() {
    setGeneratingInvoice(true);
    try {
      await api.generateInvoice(order.id);
      showToast('Invoice generated — review it, then click "Send to customer"');
      onChanged();
    } catch (err) {
      showToast(`Could not generate invoice: ${(err as Error).message}`);
    } finally {
      setGeneratingInvoice(false);
    }
  }
  async function sendDocument(docId: string, name: string) {
    try {
      await api.setDocumentVisibility(order.id, docId, true);
      showToast(`${name} sent — the customer can download it in the Garm App now`);
      onChanged();
    } catch (err) {
      showToast(`Could not send: ${(err as Error).message}`);
    }
  }
  async function unsendDocument(docId: string, name: string) {
    try {
      await api.setDocumentVisibility(order.id, docId, false);
      showToast(`${name} hidden from the customer again`);
      onChanged();
    } catch (err) {
      showToast(`Could not update: ${(err as Error).message}`);
    }
  }

  async function uploadDocument(file: File | undefined) {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { showToast('Keep documents under 4MB'); return; }
    setUploadingDoc(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await api.uploadOrderDocument(order.id, { name: file.name, kind: docKind, dataUrl });
      showToast(`${DOC_KIND_LABELS[docKind]} uploaded — the customer can download it in the Garm App now`);
      onChanged();
    } catch (err) {
      showToast(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploadingDoc(false);
    }
  }

  async function removeDocument(docId: string, name: string) {
    try {
      await api.deleteOrderDocument(order.id, docId);
      showToast(`${name} removed`);
      onChanged();
    } catch (err) {
      showToast(`Could not remove: ${(err as Error).message}`);
    }
  }

  // ── The one obvious "what do I do next" action for this order ──────────────
  // Covers the internal legs the customer never sees: production started,
  // goods received back from the manufacturer (→ shipping starts, customer's
  // tracker flips to Shipped), and delivery.
  const nextAction = ((): { label: string; icon: string; patch: Record<string, unknown> } | null => {
    if (order.status === 'CANCELLED' || order.status === 'DELIVERED') return null;
    if (order.status === 'ASSIGNED') return { label: 'Start Production', icon: 'factory', patch: { status: 'IN_PROGRESS' } };
    // Goods back from the manufacturer → in-house QC (BOTH Individual and
    // Organisation orders are now inspected before shipping).
    if (order.status === 'IN_PROGRESS') {
      return { label: 'Received from Manufacturer · Send to QC', icon: 'shieldSm', patch: { status: 'QC_READY' } };
    }
    // At QC_READY the inspection is done on the Quality Control page (sidebar) —
    // no single next-step button here.
    if (order.status === 'QC_READY') return null;
    // After QC passes: Individuals ship straight away; Organisations invoice the
    // balance first.
    if (order.status === 'QC_APPROVED') {
      return isB2C
        ? { label: 'Start Shipping', icon: 'package', patch: { status: 'SHIPPED' } }
        : { label: 'Mark Invoiced', icon: 'file', patch: { status: 'INVOICED' } };
    }
    // Balance received (recorded offline at Invoiced, or paid in the app →
    // status PAID): shipping is the next step.
    if (!isB2C && (order.status === 'PAID' || (order.status === 'INVOICED' && paid))) return { label: 'Start Shipping', icon: 'package', patch: { status: 'SHIPPED' } };
    if (order.status === 'SHIPPED') return { label: 'Mark Delivered', icon: 'checkCircle', patch: { status: 'DELIVERED' } };
    return null;
  })();

  async function runNextAction() {
    if (!nextAction) return;
    // Shipping: capture courier + tracking number first, so the admin has the
    // dispatch record and the customer can follow the parcel from Track.
    if (nextAction.patch.status === 'SHIPPED') { setShipModal(true); return; }
    const effects: Record<string, string> = {
      IN_PROGRESS: 'Marks production as started. Internal only — the customer already sees In production.',
      SHIPPED: `The customer is notified immediately: their tracker moves to Shipped. Do this once the goods are received from ${order.mfr !== '—' ? order.mfr : 'the manufacturer'} and packed for dispatch.`,
      QC_READY: 'Sends the received goods to Quality Control. Internal only.',
      INVOICED: 'Marks this order as invoiced.',
      DELIVERED: `Mark this only once the courier confirms delivery${order.trackingNumber ? ` (track ${order.trackingCourier || ''} ${order.trackingNumber} on the courier's site)` : ''}. The customer's tracker completes with Delivered and the order is closed.`,
    };
    const ok = await confirm({
      title: nextAction.label,
      message: `${order.no} — ${effects[String(nextAction.patch.status)] || 'Updates the order status.'}`,
      confirmLabel: nextAction.label,
    });
    if (!ok) return;
    const msgs: Record<string, string> = {
      IN_PROGRESS: 'Production started — the customer sees In production in Track.',
      SHIPPED: 'Marked as Shipped — the customer got the Shipped update in Track.',
      QC_READY: 'Goods received — sent to Quality Control.',
      INVOICED: 'Invoiced.',
      DELIVERED: 'Delivered — the customer\'s tracker is complete. Order closed.',
    };
    patchOrder(nextAction.patch, msgs[String(nextAction.patch.status)] || 'Order updated');
  }

  const stepTime = (s: string): string => {
    if (s === 'NEW') return order.date;
    if (s === 'CONFIRMED' && order.confirmedAt) return order.confirmedAt;
    if (s === 'PAID' && order.paymentDate) return order.paymentDate;
    return '';
  };

  return (
    <div className="print-area">
      <div className="back-btn no-print" onClick={onBack}><Icon name="arrowLeft" /> Back to Orders</div>
      <div className="detail-header">
        <div className="detail-title">{order.no}</div>
        <Badge status={order.status} />
        <span className="tag">{orderForLabel(order)}</span>
        <div style={{ flex: 1 }}></div>
        <div className="no-print" style={{ display: 'flex', gap: 8 }}>
          {awaitingConfirmation && (
            <button className="btn btn-primary btn-sm" onClick={() => setConfirmModal(true)}><Icon name="checkCircle" /> Accept &amp; Confirm</button>
          )}
          {nextAction && (
            <button className="btn btn-primary btn-sm" onClick={runNextAction}><Icon name={nextAction.icon} /> {nextAction.label}</button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => setEmployeeModal(true)}><Icon name="user" /> Assign Employee</button>
          <button className={`btn ${order.status === 'PAID' && isB2C ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setAssignModal(true)}><Icon name="factory" /> Assign Manufacturer</button>
          {canCancel && (
            <button className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#f3c2c2' }} onClick={() => setCancelModal(true)}><Icon name="xCircle" /> Cancel Order</button>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Icon name="printer" /> Print</button>
        </div>
      </div>

      {awaitingConfirmation && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--brand, #6c5ce7)' }}>
          <b>This order is waiting for your confirmation.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>
            The customer has submitted their order in the Garm App. Accept &amp; Confirm to finalise the price and unlock payment on their side — production can start only after they pay.
          </div>
        </div>
      )}
      {awaitingPayment && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--warning, #f59e0b)' }}>
          <b>Confirmed — waiting for the customer's payment.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>The customer can now pay {formatINR(displayTotal)} in the Garm App. Production stays locked until payment is received.</div>
        </div>
      )}
      {isB2C && order.status === 'PAID' && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--success, #059669)' }}>
          <b>Payment received — assign a manufacturer to start production.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>Once assigned, the customer's tracker moves to In production automatically.</div>
        </div>
      )}
      {order.status === 'IN_PROGRESS' && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--brand, #C8A97E)' }}>
          <b>In production with {order.mfr}.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>
            When the goods arrive back from the manufacturer, click "Received from Manufacturer · Send to QC" above — you inspect the run before shipping.
          </div>
        </div>
      )}
      {order.status === 'QC_READY' && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--brand, #C8A97E)' }}>
          <b>Awaiting quality control.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>
            Inspect this production run on the <b>Quality Control</b> page (left menu). Passing it {isB2C ? 'lets you ship to the customer' : 'moves it to invoicing, then shipping'}; failing sends it back to the manufacturer for rework.
          </div>
        </div>
      )}
      {/* Used to trigger at status === 'NEW' — before Accept & Confirm even
          existed for organisations, that was the only status this card could
          ever see. Now that orgs go through the same NEW -> CONFIRMED flow as
          Individuals, showing "waiting for the advance" at NEW (alongside the
          "waiting for your confirmation" card above, before any price has
          even been set) was both premature and confusing. Gated on CONFIRMED
          instead, same as the generic awaitingPayment card below it. */}
      {!isB2C && order.status === 'CONFIRMED' && !['partial', 'paid'].includes(order.paymentStatus || '') && order.pay === 'PENDING' && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--warning, #f59e0b)' }}>
          <b>Waiting for the advance payment.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>Once the quote is agreed, the customer pays the 30% advance in the Garm App (or record it offline). Production can start only after the advance is received.</div>
        </div>
      )}
      {!isB2C && order.status === 'INVOICED' && !paid && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--warning, #f59e0b)' }}>
          <b>QC passed &amp; invoiced — waiting for the balance payment.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>Share the QC report + invoice (Documents card). The customer pays the balance in the Garm App, or record it offline — shipping unlocks after full payment.</div>
        </div>
      )}
      {order.status === 'SHIPPED' && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid var(--info, #2563eb)' }}>
          <b>Shipped — on the way to the customer.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>When delivery is confirmed, click "Mark Delivered" above — the customer's tracker completes.</div>
        </div>
      )}
      {order.status === 'CANCELLED' && (
        <div className="card card-pad no-print" style={{ marginBottom: 14, borderLeft: '3px solid #dc2626' }}>
          <b>This order is cancelled.</b>
          <div className="small-muted" style={{ marginTop: 4 }}>
            {order.cancelReason ? `Reason: ${order.cancelReason}. ` : 'The customer sees this as Cancelled in the Garm App. '}
            {refundedTotal > 0 ? `Refunded ${formatINR(refundedTotal)}.` : (everPaid ? 'Issue a refund from the Payment card if money was collected.' : 'No payment was collected.')}
          </div>
        </div>
      )}

      <div className="detail-grid">
        {/* Customer, delivery & contact */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: '13.5px' }}>Customer &amp; Delivery</h3>
          <div className="info-row"><span className="k">Customer</span><span className="v">{order.cust}</span></div>
          <div className="info-row"><span className="k">Order for</span><span className="v">{orderForLabel(order)}</span></div>
          {order.orgType && <div className="info-row"><span className="k">Organisation type</span><span className="v">{order.orgType}</span></div>}
          {order.contactName && <div className="info-row"><span className="k">Contact name</span><span className="v">{order.contactName}</span></div>}
          {order.contactPhone && <div className="info-row"><span className="k">Phone</span><span className="v">{order.contactPhone}</span></div>}
          <div className="info-row"><span className="k">Email</span><span className="v">{order.contactEmail || order.email || '—'}</span></div>
          <div className="info-row"><span className="k">Delivery address</span><span className="v" style={{ maxWidth: 180 }}>{[order.deliveryAddress || order.address, order.deliveryCity, order.deliveryPin].filter(Boolean).join(', ') || '—'}</span></div>
          <div className="info-row"><span className="k">Order date</span><span className="v">{order.date}</span></div>
          {order.etaDate && <div className="info-row"><span className="k">Estimated delivery</span><span className="v">{order.etaDate}</span></div>}
          <hr className="sep" />
          <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Handling</h3>
          <div className="info-row"><span className="k">Assigned employee</span><span className="v">{order.assignedEmployee || '—'}</span></div>
          <div className="info-row"><span className="k">Manufacturer</span><span className="v">{order.mfr}</span></div>
        </div>

        {/* Full order specification */}
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: '13.5px' }}>Order Details</h3>
          {order.serviceLabel && <div className="info-row"><span className="k">Service</span><span className="v">{order.serviceLabel}</span></div>}
          {order.garmentType && <div className="info-row"><span className="k">Garment</span><span className="v">{order.garmentType}</span></div>}
          {order.fabric && <div className="info-row"><span className="k">Fabric</span><span className="v">{order.fabric}</span></div>}
          {order.gsm && <div className="info-row"><span className="k">GSM</span><span className="v">{order.gsm}</span></div>}
          {order.weave && <div className="info-row"><span className="k">Weave</span><span className="v">{order.weave}</span></div>}
          {order.fabricSource && <div className="info-row"><span className="k">Fabric source</span><span className="v">{order.fabricSource}</span></div>}
          {!!order.colors?.length && (
            <div className="info-row"><span className="k">Colours</span>
              <span className="v" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {order.colors.map((c, i) => (
                  <span key={i} className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.hex, border: '1px solid rgba(0,0,0,0.15)', display: 'inline-block' }}></span>
                    {c.label}{c.pantone ? ` (${c.pantone})` : ''}
                  </span>
                ))}
              </span>
            </div>
          )}
          {!!order.sizes?.length && (
            <div className="info-row"><span className="k">Sizes</span>
              <span className="v" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {order.sizes.map((s, i) => <span key={i} className="tag">{s.label}: {s.qty}</span>)}
              </span>
            </div>
          )}
          <div className="info-row"><span className="k">Total pieces</span><span className="v"><b>{pieces} pcs</b></span></div>
          {order.stitching && <div className="info-row"><span className="k">Stitching</span><span className="v">{order.stitching}</span></div>}
          {order.packaging && <div className="info-row"><span className="k">Packaging</span><span className="v">{order.packaging}</span></div>}
          {!!order.accessoryItems?.length && (
            <>
              <hr className="sep" />
              <h3 style={{ margin: '0 0 8px', fontSize: '13.5px' }}>Accessory Items</h3>
              {order.accessoryItems.map((a, i) => (
                <div className="info-row" key={i}><span className="k">{a.categoryLabel}</span><span className="v">{a.itemName} × {a.qty}</span></div>
              ))}
            </>
          )}

          {!!order.lines?.length && (
            <>
              <hr className="sep" />
              <h3 style={{ margin: '0 0 8px', fontSize: '13.5px' }}>Order Items</h3>
              <table className="table">
                <thead><tr><th>Product</th><th>Size</th><th>Color</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
                <tbody>
                  {order.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.p}</td><td>{l.size}</td><td>{l.color}</td><td>{l.qty}</td><td>{l.unit ? formatINR(l.unit) : '—'}</td><td>{l.unit ? formatINR(l.qty * l.unit) : '—'}</td>
                    </tr>
                  ))}
                  {serviceFee > 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', color: 'var(--muted)' }}>Service fee</td>
                      <td>{formatINR(serviceFee)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          <div className="dp-totals" style={{ marginTop: 10 }}>
            {/* Rate = goods only (total − service fee) ÷ pieces, so rate × pcs + fee = total — never fee-inclusive (that double-counts the fee). */}
            {pieces > 0 && displayTotal > 0 && <div className="r"><span>Rate</span><span>{formatINR(Math.round(Math.max(0, displayTotal - serviceFee) / pieces))}/pc × {pieces} pcs</span></div>}
            <div className="r"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            <div className="r"><span>Tax (18% incl.)</span><span>{formatINR(tax)}</span></div>
            {serviceFee > 0 && <div className="r"><span>Service fee</span><span>{formatINR(serviceFee)}</span></div>}
            <div className="r total"><span>Total</span><span>{formatINR(displayTotal)}</span></div>
          </div>

          {order.notes && (
            <>
              <hr className="sep" />
              <div className="info-row"><span className="k">Customer notes</span><span className="v" style={{ maxWidth: 240 }}>{order.notes}</span></div>
            </>
          )}

          <hr className="sep" />
          <h3 className="no-print" style={{ margin: '0 0 8px', fontSize: '13.5px' }}>Admin Notes</h3>
          <div className="no-print">
            <textarea className="ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about this order…" />
            <div style={{ textAlign: 'right', marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => patchOrder({ notes: note }, 'Note saved')}>Save Note</button>
            </div>
          </div>
        </div>

        {/* Timeline + payment */}
        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '13.5px' }}>Status Timeline</h3>
            {order.status === 'CANCELLED' ? (
              <div className="small-muted">This order was cancelled.</div>
            ) : (
              <ul className="timeline">
                {steps.map((s, i) => {
                  const cls = i < curIdx ? 'done' : i === curIdx ? 'current' : '';
                  const ic = i <= curIdx ? 'check' : 'clock';
                  const time = i <= curIdx ? (stepTime(s.s) || order.date) : 'Pending';
                  return (
                    <li className={cls} key={s.s}>
                      <div className="tdot"><Icon name={ic} /></div>
                      <div><div className="tlabel">{s.l}</div><div className="ttime">{time}</div></div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Payment</h3>
            <div className="info-row"><span className="k">Status</span><span className="v"><Badge status={paid ? 'COMPLETED' : order.pay} /></span></div>
            <div className="info-row"><span className="k">Amount</span><span className="v">{formatINR(displayTotal)}</span></div>
            <div className="info-row"><span className="k">Method</span><span className="v">{order.paymentMode || (paid ? 'Recorded' : '—')}</span></div>
            {order.paymentDate && <div className="info-row"><span className="k">Paid on</span><span className="v">{order.paymentDate}</span></div>}
            {order.paymentReference && <div className="info-row"><span className="k">Reference</span><span className="v">{order.paymentReference}</span></div>}
            {refundedTotal > 0 && (
              <>
                <div className="info-row"><span className="k">Refunded</span><span className="v" style={{ color: '#dc2626', fontWeight: 600 }}>−{formatINR(refundedTotal)}{fullyRefunded ? ' (full)' : ' (partial)'}</span></div>
                {order.refundedAt && <div className="info-row"><span className="k">Refunded on</span><span className="v">{order.refundedAt}</span></div>}
                {order.refundReason && <div className="info-row"><span className="k">Refund reason</span><span className="v">{order.refundReason}</span></div>}
                {order.refundReference && <div className="info-row"><span className="k">Refund ref</span><span className="v">{order.refundReference}</span></div>}
              </>
            )}
            {isB2C && !paid && (
              <div className="small-muted" style={{ marginTop: 8 }}>
                {awaitingConfirmation
                  ? 'Payment unlocks in the Garm App once you Accept & Confirm this order.'
                  : 'The customer pays in the Garm App. Use Record Payment only for offline (cash/bank) payments.'}
              </div>
            )}
            <div className="no-print" style={{ marginTop: 10 }}>
              <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={paid} onClick={() => setPaymentModal(true)}>
                <Icon name="card" /> {paid ? 'Payment received' : 'Record Offline Payment'}
              </button>
              {canRefund && (
                <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8, color: '#dc2626', borderColor: '#f3c2c2' }}
                  onClick={() => { setRefundForm({ amount: Math.max(0, displayTotal - refundedTotal), reason: '', reference: '' }); setRefundModal(true); }}>
                  <Icon name="refresh" /> {refundedTotal > 0 ? 'Issue Further Refund' : 'Issue Refund'}
                </button>
              )}
              {fullyRefunded && <div className="small-muted" style={{ marginTop: 8, textAlign: 'center' }}>Fully refunded</div>}
            </div>
          </div>

          {/* Manufacturer payment — what WE owe/pay the manufacturer for this run. */}
          {mfrAssigned && (
            <div className="card card-pad" style={{ marginBottom: 14 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Manufacturer Payment</h3>
              <div className="info-row"><span className="k">Manufacturer</span><span className="v">{order.mfr}</span></div>
              <div className="info-row"><span className="k">Bill amount</span><span className="v">{mfrBill > 0 ? formatINR(mfrBill) : 'Not set'}</span></div>
              <div className="info-row"><span className="k">Paid</span><span className="v">{formatINR(mfrPaid)}{mfrBill > 0 ? ` / ${formatINR(mfrBill)}` : ''}</span></div>
              <div className="info-row"><span className="k">Status</span><span className="v"><Badge status={order.mfrPayStatus || 'PENDING'} /></span></div>
              {order.mfrPaidAt && <div className="info-row"><span className="k">Last paid</span><span className="v">{order.mfrPaidAt}</span></div>}
              {order.mfrPayMethod && <div className="info-row"><span className="k">Method</span><span className="v">{order.mfrPayMethod}</span></div>}
              {order.mfrPayReference && <div className="info-row"><span className="k">Reference</span><span className="v">{order.mfrPayReference}</span></div>}
              <div className="no-print" style={{ marginTop: 10 }}>
                <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={mfrFullyPaid}
                  onClick={() => { setMfrPayForm({ bill: mfrBill, amount: mfrBill > 0 ? Math.max(0, mfrBill - mfrPaid) : 0, method: order.mfrPayMethod || 'Bank Transfer', reference: '' }); setMfrPayModal(true); }}>
                  <Icon name="factory" /> {mfrFullyPaid ? 'Manufacturer paid' : (mfrPaid > 0 ? 'Record further payment' : 'Set bill / Record payment')}
                </button>
              </div>
            </div>
          )}

          {/* Customer rating & feedback — submitted from the Garm App after delivery. */}
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Customer Rating</h3>
            {order.rating ? (
              <>
                <div className="info-row">
                  <span className="k">Rating</span>
                  <span className="v" style={{ letterSpacing: 1 }}>
                    <span style={{ color: '#e0a800' }}>{'★'.repeat(order.rating)}</span>
                    <span style={{ color: 'var(--border)' }}>{'★'.repeat(5 - order.rating)}</span>
                    <span style={{ marginLeft: 6, color: 'var(--muted-fg, #666)' }}>{order.rating}/5</span>
                  </span>
                </div>
                {order.ratedAt && <div className="info-row"><span className="k">Rated on</span><span className="v">{order.ratedAt}</span></div>}
                {order.ratingFeedback && (
                  <div style={{ marginTop: 8 }}>
                    <div className="small-muted" style={{ marginBottom: 2 }}>Feedback</div>
                    <div style={{ fontSize: '13px', lineHeight: 1.4 }}>“{order.ratingFeedback}”</div>
                  </div>
                )}
              </>
            ) : (
              <div className="small-muted">No rating yet — the customer can rate this order in the Garm App once it's delivered.</div>
            )}
          </div>

          <div className="card card-pad no-print">
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Documents</h3>

            {/* Customer uploads (design/logo references) — previewed inline so the
                team SEES the customer's design at a glance, plus download. */}
            {(() => {
              const custDocs = (order.documents || []).filter((d) => d.uploadedBy === 'customer');
              if (!custDocs.length) return null;
              const isImg = (d: { dataUrl?: string }) => (d.dataUrl || '').startsWith('data:image');
              return (
                <div style={{ marginBottom: 10 }}>
                  <div className="cust-sub" style={{ marginBottom: 6, fontWeight: 600 }}>
                    Customer design uploads ({custDocs.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                    {custDocs.filter(isImg).map((d) => (
                      <a key={d.id} onClick={() => setPreviewDoc({ name: d.name, dataUrl: d.dataUrl })} title={`${d.name} — click to enlarge`}
                        style={{ cursor: 'zoom-in', display: 'block', width: 88, height: 88, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border, #e5e7eb)', background: '#fafafa' }}>
                        <img src={d.dataUrl} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </a>
                    ))}
                  </div>
                  {custDocs.map((d) => (
                    <div className="doc-item" key={d.id}>
                      <Icon name="file" />
                      <span className="fill">{d.name}<div className="cust-sub">{DOC_KIND_LABELS[d.kind] || d.kind} · from customer{d.createdAt ? ` · ${d.createdAt}` : ''}</div></span>
                      {isImg(d)
                        ? <a className="link" onClick={() => setPreviewDoc({ name: d.name, dataUrl: d.dataUrl })}>Preview</a>
                        : <a className="link" onClick={() => setPreviewDoc({ name: d.name, dataUrl: d.dataUrl })}>Open</a>}
                      <a className="link" style={{ marginLeft: 8 }} onClick={() => downloadDataUrl(d.dataUrl, d.name)}>Download</a>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Admin documents — a generated-but-unsent invoice shows as a DRAFT
                with a Send button; sent docs show "shared with customer". */}
            {(order.documents || []).filter((d) => d.uploadedBy === 'admin').map((d) => {
              const draft = d.visible === false;
              return (
                <div className="doc-item" key={d.id}>
                  <Icon name="file" />
                  <span className="fill">
                    {d.name}
                    {draft
                      ? <span className="tag" style={{ marginLeft: 6, padding: '1px 7px', background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>Draft — not sent</span>
                      : <span className="tag" style={{ marginLeft: 6, padding: '1px 7px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>Sent</span>}
                    <div className="cust-sub">{DOC_KIND_LABELS[d.kind] || d.kind}{d.generated ? ' · generated' : ''}{d.createdAt ? ` · ${d.createdAt}` : ''}</div>
                  </span>
                  <a className="link" onClick={() => downloadDataUrl(d.dataUrl, d.name)}>Preview</a>
                  {draft
                    ? <a className="link" style={{ marginLeft: 8, fontWeight: 700 }} onClick={() => sendDocument(d.id, d.name)}>Send to customer</a>
                    : <a className="link" style={{ marginLeft: 8 }} onClick={() => unsendDocument(d.id, d.name)}>Unsend</a>}
                  <a className="link" style={{ color: 'var(--danger, #dc2626)', marginLeft: 8 }} onClick={() => removeDocument(d.id, d.name)}>Remove</a>
                </div>
              );
            })}

            {!(order.documents || []).length && (
              <div className="small-muted" style={{ marginBottom: 8 }}>No documents yet. Generate an invoice in one click, or upload a quotation / billing document — sent documents appear in the customer's Garm App instantly.</div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" disabled={generatingInvoice} onClick={generateInvoice}>
                <Icon name="file" /> {generatingInvoice ? 'Generating…' : 'Generate Invoice'}
              </button>
              <span className="small-muted">or</span>
              <select className="field-sm" value={docKind} onChange={(e) => setDocKind(e.target.value)}>
                <option value="INVOICE">Invoice</option>
                <option value="QUOTATION">Quotation</option>
                <option value="BILLING">Billing</option>
                <option value="OTHER">Other</option>
              </select>
              <label className="btn btn-outline btn-sm" style={{ cursor: uploadingDoc ? 'wait' : 'pointer' }}>
                <Icon name="upload" /> {uploadingDoc ? 'Uploading…' : 'Upload'}
                <input type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} disabled={uploadingDoc}
                  onChange={(e) => { uploadDocument(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
            <div className="small-muted" style={{ marginTop: 6 }}>Generate Invoice builds a PDF from this order. It stays a draft until you click <b>Send to customer</b>.</div>
            <hr className="sep" />
            <div className="doc-item"><Icon name="printer" /><span className="fill">Order sheet {order.no}</span><a className="link" onClick={() => window.print()}>Print</a></div>
          </div>
        </div>
      </div>

      {/* Accept & Confirm (B2C) */}
      <Modal open={confirmModal} title={`Accept & Confirm ${order.no}`} confirmLabel="Confirm Order" onClose={() => setConfirmModal(false)} onConfirm={confirmOrder}>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          Confirming pushes the final price to the customer's Garm App and unlocks their payment step. Production can start only after they pay.
        </div>
        <div className="form-grid">
          <div className="form-field"><label>Final price (₹, incl. tax)</label><input type="number" value={confirmForm.price} onChange={(e) => setConfirmForm({ ...confirmForm, price: Number(e.target.value) })} /></div>
          <div className="form-field"><label>Estimated delivery</label><input type="date" value={confirmForm.eta} onChange={(e) => setConfirmForm({ ...confirmForm, eta: e.target.value })} /></div>
          <div className="form-field full">
            <label>Handled by (employee)</label>
            <select value={confirmForm.employee} onChange={(e) => setConfirmForm({ ...confirmForm, employee: e.target.value })}>
              {employees.map((u) => <option key={u.id} value={u.name}>{u.name} — {u.role}</option>)}
            </select>
            <div className="small-muted" style={{ marginTop: 4 }}>Only the name shown to the customer changes — the contact number, email and WhatsApp stay the company-wide coordinator details.</div>
          </div>
        </div>
      </Modal>

      {/* Assign employee */}
      <Modal open={employeeModal} title="Assign Employee" confirmLabel="Assign" onClose={() => setEmployeeModal(false)} onConfirm={confirmEmployee}>
        <div className="form-grid">
          <div className="form-field full">
            <label>Employee handling this order</label>
            <select value={assignEmp} onChange={(e) => setAssignEmp(e.target.value)}>
              {employees.map((u) => <option key={u.id} value={u.name}>{u.name} — {u.role}</option>)}
            </select>
            <div className="small-muted" style={{ marginTop: 4 }}>The customer's "Your procurement manager" card shows this name. Phone, email and WhatsApp stay the company-wide details from Settings — always.</div>
          </div>
        </div>
      </Modal>

      {/* Assign manufacturer */}
      <Modal open={assignModal} title="Assign to Manufacturer" confirmLabel="Assign Order" onClose={() => setAssignModal(false)} onConfirm={confirmAssign}>
        {isB2C && !paid && (
          <div className="small-muted" style={{ marginBottom: 10, color: 'var(--danger, #dc2626)' }}>
            This Individual order isn't paid yet — the backend will block assignment until payment is received.
          </div>
        )}
        <div className="form-grid">
          <div className="form-field full">
            <label>Select manufacturer</label>
            <select value={assignMfr} onChange={(e) => setAssignMfr(e.target.value)}>
              {manufacturers.map((m) => <option key={m.id} value={m.name}>{m.name} ({m.city}) — {m.lead} day lead time</option>)}
            </select>
          </div>
          <div className="form-field full"><label>Estimated delivery date</label><input type="date" value={assignEta} onChange={(e) => setAssignEta(e.target.value)} /></div>
        </div>
      </Modal>

      {/* Dispatch — capture courier + tracking */}
      <Modal open={shipModal} title={`Ship ${order.no}`} confirmLabel="Mark Shipped" onClose={() => setShipModal(false)} onConfirm={confirmShip}>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          Enter the courier and tracking number (recommended). The customer sees these on their Track screen and can follow the parcel. You'll later click <b>Mark Delivered</b> once the courier confirms delivery.
        </div>
        <div className="form-grid">
          <div className="form-field"><label>Courier / logistics</label>
            <input list="couriers" value={shipForm.courier} onChange={(e) => setShipForm({ ...shipForm, courier: e.target.value })} placeholder="e.g. DTDC, Delhivery, Blue Dart" />
            <datalist id="couriers"><option value="DTDC" /><option value="Delhivery" /><option value="Blue Dart" /><option value="India Post" /><option value="Ekart" /><option value="Xpressbees" /><option value="Professional Couriers" /></datalist>
          </div>
          <div className="form-field"><label>Tracking number</label><input value={shipForm.tracking} onChange={(e) => setShipForm({ ...shipForm, tracking: e.target.value })} placeholder="e.g. DTDC-9823441" /></div>
        </div>
        <div className="small-muted" style={{ marginTop: 8 }}>You can leave these blank if not available yet — but the customer won't have anything to track.</div>
      </Modal>

      {/* Record offline payment */}
      <Modal open={paymentModal} title="Record Offline Payment" confirmLabel="Save Payment" onClose={() => setPaymentModal(false)} onConfirm={confirmPayment}>
        <div className="form-grid">
          <div className="form-field"><label>Amount (₹)</label><input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })} /></div>
          <div className="form-field"><label>Payment method</label>
            <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option>Bank Transfer</option><option>Card</option><option>UPI</option><option>Cheque</option><option>Cash</option>
            </select>
          </div>
          <div className="form-field"><label>Payment date</label><input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></div>
          <div className="form-field"><label>Reference number</label><input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="Optional" /></div>
        </div>
      </Modal>

      {/* Cancel order */}
      <Modal open={cancelModal} title={`Cancel ${order.no}?`} confirmLabel="Cancel Order" onClose={() => setCancelModal(false)} onConfirm={cancelOrder}>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          The order stops here — its status becomes <b>Cancelled</b> and the customer sees that in the Garm App (production won't proceed).
          {everPaid ? ' Any money already collected is NOT refunded automatically — use “Issue Refund” on the Payment card after cancelling.' : ' No payment has been collected, so there is nothing to refund.'}
        </div>
        <div className="form-grid">
          <div className="form-field full"><label>Reason (shown to the customer)</label>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Customer requested cancellation / out of stock" />
          </div>
        </div>
      </Modal>

      {/* Issue refund */}
      <Modal open={refundModal} title={`Refund ${order.no}`} confirmLabel="Record Refund" onClose={() => setRefundModal(false)} onConfirm={confirmRefund}>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          Records a refund against this order (e.g. after a damage complaint). Paid: <b>{formatINR(displayTotal)}</b>{refundedTotal > 0 ? ` · already refunded ${formatINR(refundedTotal)}` : ''}. Max you can refund now: <b>{formatINR(Math.max(0, displayTotal - refundedTotal))}</b>. Process the actual money transfer in your bank/UPI/gateway; this logs it and updates the customer.
        </div>
        <div className="form-grid">
          <div className="form-field"><label>Refund amount (₹)</label><input type="number" value={refundForm.amount} onChange={(e) => setRefundForm({ ...refundForm, amount: Number(e.target.value) })} /></div>
          <div className="form-field"><label>Reference (optional)</label><input value={refundForm.reference} onChange={(e) => setRefundForm({ ...refundForm, reference: e.target.value })} placeholder="Bank/UPI txn id" /></div>
          <div className="form-field full"><label>Reason (shown to the customer)</label><input value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} placeholder="e.g. Damaged goods — full refund" /></div>
        </div>
      </Modal>

      {/* Manufacturer payment */}
      <Modal open={mfrPayModal} title={`Pay ${order.mfr}`} confirmLabel="Save" onClose={() => setMfrPayModal(false)} onConfirm={confirmMfrPayment}>
        <div className="small-muted" style={{ marginBottom: 12 }}>
          Record what you owe and pay the manufacturer for producing this order.{mfrPaid > 0 ? ` Already paid: ${formatINR(mfrPaid)}.` : ''} This tracks your production cost — do the actual bank/UPI transfer separately.
        </div>
        <div className="form-grid">
          <div className="form-field"><label>Bill amount (₹)</label><input type="number" value={mfrPayForm.bill} onChange={(e) => setMfrPayForm({ ...mfrPayForm, bill: Number(e.target.value) })} placeholder="Total owed to manufacturer" /></div>
          <div className="form-field"><label>Pay now (₹)</label><input type="number" value={mfrPayForm.amount} onChange={(e) => setMfrPayForm({ ...mfrPayForm, amount: Number(e.target.value) })} placeholder="0 to only set the bill" /></div>
          <div className="form-field"><label>Method</label>
            <select value={mfrPayForm.method} onChange={(e) => setMfrPayForm({ ...mfrPayForm, method: e.target.value })}>
              <option>Bank Transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option>
            </select>
          </div>
          <div className="form-field"><label>Reference (optional)</label><input value={mfrPayForm.reference} onChange={(e) => setMfrPayForm({ ...mfrPayForm, reference: e.target.value })} placeholder="Bank/UPI txn id" /></div>
        </div>
      </Modal>

      {/* Customer design preview lightbox */}
      {previewDoc && (
        <div
          onClick={() => setPreviewDoc(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(13,13,13,0.75)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out',
          }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw' }}>{previewDoc.name}</span>
              <a className="link" style={{ color: '#fff', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}
                onClick={() => downloadDataUrl(previewDoc.dataUrl, previewDoc.name)}>Download</a>
              <a className="link" style={{ color: '#fff', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}
                onClick={() => setPreviewDoc(null)}>Close ✕</a>
            </div>
            {previewDoc.dataUrl.startsWith('data:image')
              ? <img src={previewDoc.dataUrl} alt={previewDoc.name}
                  style={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 10, background: '#fff' }} />
              : <iframe src={previewDoc.dataUrl} title={previewDoc.name}
                  style={{ width: '82vw', height: '78vh', border: 'none', borderRadius: 10, background: '#fff' }} />}
          </div>
        </div>
      )}
    </div>
  );
}
