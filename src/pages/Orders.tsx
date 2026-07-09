import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatINR, manufacturersData, ordersData, type Order } from '../data/mockData';

const STEPS = [
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

export default function Orders() {
  const [selected, setSelected] = useState<Order | null>(null);

  return selected ? (
    <OrderDetail order={selected} onBack={() => setSelected(null)} />
  ) : (
    <OrdersList onOpen={setSelected} />
  );
}

function OrdersList({ onOpen }: { onOpen: (o: Order) => void }) {
  const showToast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [mfr, setMfr] = useState('');
  const [qc, setQc] = useState('');
  const [pay, setPay] = useState('');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState(false);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return ordersData.filter((o) => {
      if (q && !(o.no.toLowerCase().includes(q) || o.cust.toLowerCase().includes(q) || o.email.toLowerCase().includes(q))) return false;
      if (status && o.status !== status) return false;
      if (type && o.type !== type) return false;
      if (mfr && o.mfr !== mfr) return false;
      if (qc && o.qc !== qc) return false;
      if (pay && o.pay !== pay) return false;
      return true;
    });
  }, [search, status, type, mfr, qc, pay]);

  function toggleAll(on: boolean) {
    setChecked(on ? new Set(rows.map((r) => r.id)) : new Set());
  }
  function toggleOne(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function resetFilters() {
    setSearch(''); setStatus(''); setType(''); setMfr(''); setQc(''); setPay('');
  }

  return (
    <div>
      <div className="page-head">
        <div><div className="page-title">Orders</div><div className="page-desc">Manage B2B &amp; B2C orders end-to-end.</div></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" /> New Order</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-inline">
          <Icon name="search" />
          <input placeholder="Search order #, customer, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="field-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['NEW','ASSIGNED','IN_PROGRESS','QC_READY','QC_APPROVED','INVOICED','PAID','SHIPPED','DELIVERED','CANCELLED'].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="field-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option><option>B2B</option><option>B2C</option>
        </select>
        <select className="field-sm" value={mfr} onChange={(e) => setMfr(e.target.value)}>
          <option value="">All manufacturers</option>
          {manufacturersData.map((m) => <option key={m.id}>{m.name}</option>)}
        </select>
        <select className="field-sm" value={qc} onChange={(e) => setQc(e.target.value)}>
          <option value="">Any QC status</option><option>PENDING</option><option>PASSED</option><option>FAILED</option><option>REWORK</option>
        </select>
        <select className="field-sm" value={pay} onChange={(e) => setPay(e.target.value)}>
          <option value="">Any payment</option><option>PENDING</option><option>PARTIAL</option><option>COMPLETED</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={resetFilters}><Icon name="filter" /> Reset</button>
      </div>

      {checked.size > 0 && (
        <div className="bulkbar">
          <span>{checked.size} selected</span>
          <div className="spacer"></div>
          <button className="btn btn-outline btn-sm" onClick={() => showToast('Selected orders sent to printer')}><Icon name="printer" /> Print</button>
          <button className="btn btn-outline btn-sm" onClick={() => showToast('Assign-to-manufacturer dialog opened')}><Icon name="factory" /> Assign</button>
          <button className="btn btn-outline btn-sm" onClick={() => showToast('Marked selected orders for QC')}><Icon name="shieldSm" /> Mark for QC</button>
          <button className="btn btn-outline btn-sm" onClick={() => showToast('Invoices generated for selected orders')}><Icon name="file" /> Generate Invoices</button>
          <button className="btn btn-outline btn-sm" onClick={() => showToast('Exporting to Excel…')}><Icon name="download" /> Export</button>
        </div>
      )}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 30 }}><input type="checkbox" onChange={(e) => toggleAll(e.target.checked)} /></th>
              <th>Order #</th><th>Customer</th><th>Type</th><th>Items</th><th>Total</th><th>Status</th><th>QC</th><th>Payment</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 26 }}>No orders match these filters.</td></tr>
            )}
            {rows.map((o) => (
              <tr className="clickable" key={o.id} onClick={() => onOpen(o)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={checked.has(o.id)} onChange={() => toggleOne(o.id)} /></td>
                <td className="tnum">{o.no}</td>
                <td><div className="cust-name">{o.cust}</div><div className="cust-sub">{o.email}</div></td>
                <td><span className="tag">{o.type}</span></td>
                <td>{o.qty} units</td>
                <td className="tnum">{formatINR(o.total)}</td>
                <td><Badge status={o.status} /></td>
                <td><Badge status={o.qc} /></td>
                <td><Badge status={o.pay} /></td>
                <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="icon-btn btn-sm" style={{ width: 30, height: 30 }} onClick={() => onOpen(o)}><Icon name="eye" /></button>
                  <button className="icon-btn btn-sm" style={{ width: 30, height: 30 }} onClick={() => showToast(`Printing ${o.no}…`)}><Icon name="printer" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager">
          <span>Showing <b>{rows.length}</b> orders</span>
          <div className="pager-btns">
            <button><Icon name="chevLeft" /></button>
            <button className="active">1</button><button>2</button><button>3</button>
            <button><Icon name="chevRight" /></button>
          </div>
        </div>
      </div>

      <Modal open={modal} title="Create New Order" confirmLabel="Create Order" onClose={() => setModal(false)} onConfirm={() => showToast('Order created — ORD-20260709-011')}>
        <div className="form-grid">
          <div className="form-field"><label>Customer</label><select><option>Acme Corporation</option><option>Nova Retail Pvt Ltd</option><option>+ Create new customer</option></select></div>
          <div className="form-field"><label>Customer type</label><select><option>B2B</option><option>B2C</option></select></div>
          <div className="form-field full"><label>Delivery address</label><input placeholder="Street, city, state, postal code" /></div>
          <div className="form-field"><label>Product</label><select><option>Garm Shirt</option><option>Garm Polo</option><option>Garm Cargo Pant</option></select></div>
          <div className="form-field"><label>Quantity</label><input type="number" placeholder="100" /></div>
          <div className="form-field"><label>Size</label><select><option>S</option><option>M</option><option>L</option><option>XL</option></select></div>
          <div className="form-field"><label>Color</label><input placeholder="Black" /></div>
          <div className="form-field full"><label>Notes</label><textarea className="ta" placeholder="Customization, special instructions…"></textarea></div>
        </div>
      </Modal>
    </div>
  );
}

function OrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
  const showToast = useToast();
  const [assignModal, setAssignModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [note, setNote] = useState('Customer requested custom embroidery on collar. Confirm placement with manufacturer before production.');

  const subtotal = Math.round(order.total / 1.18);
  const tax = order.total - subtotal;
  const curIdx = STEPS.findIndex((s) => s.s === order.status);

  return (
    <div>
      <div className="back-btn" onClick={onBack}><Icon name="arrowLeft" /> Back to Orders</div>
      <div className="detail-header">
        <div className="detail-title">{order.no}</div>
        <Badge status={order.status} />
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-outline btn-sm" onClick={() => setAssignModal(true)}><Icon name="factory" /> Assign Manufacturer</button>
        <button className="btn btn-outline btn-sm" onClick={() => showToast(`Invoice generated: INV-20260701-004`)}><Icon name="file" /> Generate Invoice</button>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}><Icon name="printer" /> Print</button>
      </div>

      <div className="detail-grid">
        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: '13.5px' }}>Customer &amp; Delivery</h3>
          <div className="info-row"><span className="k">Customer</span><span className="v">{order.cust}</span></div>
          <div className="info-row"><span className="k">Type</span><span className="v"><span className="tag">{order.type}</span></span></div>
          <div className="info-row"><span className="k">Email</span><span className="v">{order.email}</span></div>
          <div className="info-row"><span className="k">Delivery address</span><span className="v" style={{ maxWidth: 160 }}>{order.address}</span></div>
          <div className="info-row"><span className="k">Manufacturer</span><span className="v">{order.mfr}</span></div>
          <div className="info-row"><span className="k">Order date</span><span className="v">{order.date}</span></div>
        </div>

        <div className="card card-pad">
          <h3 style={{ margin: '0 0 12px', fontSize: '13.5px' }}>Order Items</h3>
          <table className="table">
            <thead><tr><th>Product</th><th>Size</th><th>Color</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
            <tbody>
              {order.lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.p}</td><td>{l.size}</td><td>{l.color}</td><td>{l.qty}</td><td>{formatINR(l.unit)}</td><td>{formatINR(l.qty * l.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dp-totals" style={{ marginTop: 10 }}>
            <div className="r"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            <div className="r"><span>Tax (18%)</span><span>{formatINR(tax)}</span></div>
            <div className="r total"><span>Total</span><span>{formatINR(order.total)}</span></div>
          </div>
          <hr className="sep" />
          <h3 style={{ margin: '0 0 8px', fontSize: '13.5px' }}>Admin Notes</h3>
          <textarea className="ta" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about this order…" />
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => showToast('Note saved')}>Save Note</button>
          </div>
        </div>

        <div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '13.5px' }}>Status Timeline</h3>
            <ul className="timeline">
              {STEPS.map((s, i) => {
                const cls = i < curIdx ? 'done' : i === curIdx ? 'current' : '';
                const ic = i <= curIdx ? 'check' : 'clock';
                const time = i <= curIdx ? order.date : 'Pending';
                return (
                  <li className={cls} key={s.s}>
                    <div className="tdot"><Icon name={ic} /></div>
                    <div><div className="tlabel">{s.l}</div><div className="ttime">{time}</div></div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Related Documents</h3>
            <div className="doc-item"><Icon name="file" /><span className="fill">Quotation QTN-0421</span><a className="link" onClick={() => showToast('Opening quotation…')}>View</a></div>
            <div className="doc-item"><Icon name="file" /><span className="fill">Picking Ticket PT-0421</span><a className="link" onClick={() => showToast('Opening picking ticket…')}>View</a></div>
            <div className="doc-item"><Icon name="file" /><span className="fill">Packing Slip PS-0421</span><a className="link" onClick={() => showToast('Opening packing slip…')}>View</a></div>
          </div>
          <div className="card card-pad">
            <h3 style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Payment Info</h3>
            <div className="info-row"><span className="k">Status</span><span className="v"><Badge status={order.pay} /></span></div>
            <div className="info-row"><span className="k">Amount Due</span><span className="v">{formatINR(order.total)}</span></div>
            <div className="info-row"><span className="k">Method</span><span className="v">Bank Transfer</span></div>
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setPaymentModal(true)}>
                <Icon name="card" /> Record Payment
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal open={assignModal} title="Assign to Manufacturer" confirmLabel="Assign Order" onClose={() => setAssignModal(false)} onConfirm={() => showToast('Order assigned to manufacturer — status updated')}>
        <div className="form-grid">
          <div className="form-field full">
            <label>Select manufacturer</label>
            <select>{manufacturersData.map((m) => <option key={m.id}>{m.name} ({m.city}) — {m.lead} day lead time</option>)}</select>
          </div>
          <div className="form-field full"><label>Estimated delivery date</label><input type="date" defaultValue="2026-07-20" /></div>
          <div className="form-field full"><label>Notes to manufacturer</label><textarea className="ta" placeholder="Special instructions for this order…"></textarea></div>
        </div>
      </Modal>

      <Modal open={paymentModal} title="Record Payment" confirmLabel="Save Payment" onClose={() => setPaymentModal(false)} onConfirm={() => showToast('Payment recorded and invoice updated')}>
        <div className="form-grid">
          <div className="form-field full"><label>Order / Invoice</label><select><option>{order.no} / INV-{order.no.slice(4)}</option></select></div>
          <div className="form-field"><label>Amount (₹)</label><input type="number" placeholder={String(order.total)} /></div>
          <div className="form-field"><label>Payment method</label><select><option>Bank Transfer</option><option>Card</option><option>UPI</option><option>Cheque</option><option>Cash</option></select></div>
          <div className="form-field"><label>Payment date</label><input type="date" /></div>
          <div className="form-field"><label>Reference number</label><input placeholder="Optional" /></div>
          <div className="form-field full"><label>Notes</label><textarea className="ta" placeholder="Internal notes about this payment…"></textarea></div>
        </div>
      </Modal>
    </div>
  );
}
